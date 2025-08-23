import { App, Gtk, hook } from "astal/gtk4";
import { Variable } from "astal";
import Pango from "gi://Pango";
import AstalApps from "gi://AstalApps";
import PopupWindow from "../../common/PopupWindow";
import { Gio, GLib } from "astal";
import options from "../../option";
import { runCommandInTerminal } from "../Terminal/TerminalPopup";

const { bar } = options;

const layout = Variable.derive(
  [bar.position, bar.start, bar.center, bar.end],
  (pos, start, center, end) => {
    if (start.includes("launcher")) return `${pos}_left`;
    if (center.includes("launcher")) return `${pos}_center`;
    if (end.includes("launcher")) return `${pos}_right`;
    return `${pos}_center`;
  },
);

// Move these inside the component to avoid global state issues
let apps: AstalApps.Apps | null = null;
let cachedApps: AstalApps.Application[] = [];
let appsMonitors: Gio.FileMonitor[] = [];
let reloadTimeout: number | null = null;
let pendingChanges = 0;
const RELOAD_THROTTLE_MS = 2000;

// Standard application directories on Linux
const APP_DIRECTORIES = [
  "/usr/share/applications", // System-wide apps
  "/usr/local/share/applications", // Local system apps
  "/var/lib/flatpak/exports/share/applications", // System Flatpak apps
  `${GLib.get_home_dir()}/.local/share/applications`, // User apps
  `${GLib.get_home_dir()}/.local/share/flatpak/exports/share/applications`, // User Flatpak apps
  "/snap/bin", // Snap apps (they create .desktop files)
  "/var/lib/snapd/desktop/applications", // Snap desktop files
];

// Helper functions from the original
function couldBeMath(text: string): boolean {
  const mathChars = /^[0-9+\-*/().\s^√πe]+$/;
  const hasOperator = /[+\-*/^√]/.test(text);
  const hasNumber = /[0-9]/.test(text);
  return mathChars.test(text) && hasOperator && hasNumber;
}

function hasUnterminatedBackslash(text: string): boolean {
  return text.endsWith("\\") && !text.endsWith("\\\\");
}

function expandTilde(path: string): string {
  if (path.startsWith("~/")) {
    return path.replace("~", GLib.get_home_dir());
  }
  return path;
}

function ls(options: {
  path: string;
  silent?: boolean;
}): Array<{ parentPath: string; name: string; type: string; icon: string }> {
  try {
    const expandedPath = expandTilde(options.path);
    const dir = Gio.File.new_for_path(expandedPath);

    if (!dir.query_exists(null)) {
      return [];
    }

    const enumerator = dir.enumerate_children(
      "standard::name,standard::type,standard::icon",
      Gio.FileQueryInfoFlags.NONE,
      null,
    );

    const results: Array<{
      parentPath: string;
      name: string;
      type: string;
      icon: string;
    }> = [];
    let info: Gio.FileInfo | null;

    while ((info = enumerator.next_file(null)) !== null) {
      const name = info.get_name();
      const fileType = info.get_file_type();
      const icon = info.get_icon();

      results.push({
        parentPath: expandedPath,
        name: name || "",
        type: fileType === Gio.FileType.DIRECTORY ? "directory" : "file",
        icon: icon
          ? icon.to_string() || "text-x-generic"
          : fileType === Gio.FileType.DIRECTORY
            ? "folder"
            : "text-x-generic",
      });
    }

    return results.sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    if (!options.silent) {
      console.error("Error reading directory:", error);
    }
    return [];
  }
}

function execAsync(command: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const [success, , , stdout] = GLib.spawn_async_with_pipes(
        null, // working directory
        command,
        null, // envp
        GLib.SpawnFlags.SEARCH_PATH,
        null, // child_setup
      );

      if (!success) {
        reject(new Error("Failed to spawn process"));
        return;
      }

      // Read stdout
      const stdoutChannel = GLib.IOChannel.unix_new(stdout);
      let output = "";

      const readOutput = () => {
        try {
          const [status, data] = stdoutChannel.read_to_end();
          if (status === GLib.IOStatus.NORMAL) {
            output += data;
          }
          resolve(output);
        } catch (e) {
          reject(e);
        }
        return false;
      };

      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, readOutput);
    } catch (err) {
      reject(err);
    }
  });
}

function exec(command: string): string {
  try {
    const [success, output] = GLib.spawn_command_line_sync(command);
    return success && output ? new TextDecoder().decode(output) : "";
  } catch {
    return "";
  }
}

// Search result types
interface SearchResult {
  type:
    | "app"
    | "math"
    | "directory"
    | "command"
    | "web"
    | "action"
    | "ai"
    | "clipboard";
  title: string;
  subtitle: string;
  icon: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

// Clipboard history item structure
interface ClipboardItem {
  value: string;
  recorded: string;
  filePath: string;
  pinned: boolean;
}

// Cached clipboard items
let cachedClipboard: ClipboardItem[] = [];
let clipboardCacheTime = 0;
const CLIPBOARD_CACHE_TTL = 30000; // 30 seconds

function initializeApps() {
  try {
    // Clean up any existing instance
    if (apps) {
      apps = null;
    }

    // Create fresh instance
    apps = new AstalApps.Apps();
    reloadAppsCache();
    return true;
  } catch (error) {
    console.error("Failed to initialize apps:", error);
    return false;
  }
}

function reloadAppsCache() {
  if (!apps) {
    if (!initializeApps()) {
      cachedApps = [];
      return;
    }
  }

  try {
    cachedApps = apps!.fuzzy_query("");
  } catch (error) {
    console.error("Failed to load apps cache:", error);
    cachedApps = [];
    // Try to reinitialize
    initializeApps();
  }
}

function throttledReload() {
  if (reloadTimeout !== null) {
    pendingChanges++;
    return;
  }
  pendingChanges = 0;
  reloadTimeout = GLib.timeout_add(
    GLib.PRIORITY_DEFAULT,
    RELOAD_THROTTLE_MS,
    () => {
      try {
        if (!apps && !initializeApps()) {
          return false;
        }
        apps!.reload();
        reloadAppsCache();
      } catch (error) {
        console.error("Reload apps failed:", error);
        // Try to reinitialize on error
        initializeApps();
      } finally {
        reloadTimeout = null;
        if (pendingChanges > 0) {
          throttledReload();
        }
      }
      return false;
    },
  );
}

function setupAppsFolderMonitor() {
  // Clean up existing monitors first
  cleanupMonitor();

  const significantChangeTypes = [
    Gio.FileMonitorEvent.CREATED,
    Gio.FileMonitorEvent.DELETED,
    Gio.FileMonitorEvent.RENAMED,
    Gio.FileMonitorEvent.CHANGED,
  ];

  APP_DIRECTORIES.forEach((dirPath) => {
    try {
      const appsFolder = Gio.File.new_for_path(dirPath);

      // Check if directory exists before monitoring
      if (!appsFolder.query_exists(null)) {
        return;
      }

      const monitor = appsFolder.monitor_directory(
        Gio.FileMonitorFlags.WATCH_MOVES,
        null,
      );

      monitor.connect("changed", (_monitor, file, _otherFile, eventType) => {
        const filePath = file?.get_path() || "";

        // Only care about .desktop files and significant events
        if (
          !filePath.endsWith(".desktop") &&
          eventType === Gio.FileMonitorEvent.CHANGED
        ) {
          return;
        }

        if (significantChangeTypes.includes(eventType)) {
          console.log(`App change detected in ${dirPath}: ${filePath}`);
          throttledReload();
        }
      });

      appsMonitors.push(monitor);
    } catch (error) {
      console.error(`Failed to monitor directory ${dirPath}:`, error);
    }
  });
}

function cleanupMonitor() {
  if (appsMonitors.length > 0) {
    appsMonitors.forEach((monitor) => {
      try {
        monitor.cancel();
      } catch (error) {
        console.error("Error canceling monitor:", error);
      }
    });
    appsMonitors = [];
  }

  if (reloadTimeout !== null) {
    GLib.source_remove(reloadTimeout);
    reloadTimeout = null;
  }
}

function readClipboardHistory(): ClipboardItem[] {
  try {
    const now = Date.now();

    // Use cached data if it's still fresh
    if (
      cachedClipboard.length > 0 &&
      now - clipboardCacheTime < CLIPBOARD_CACHE_TTL
    ) {
      return cachedClipboard;
    }

    const clipboardFile = `${GLib.get_home_dir()}/.config/clipse/clipboard_history.json`;
    const file = Gio.File.new_for_path(clipboardFile);

    if (!file.query_exists(null)) {
      return [];
    }

    const [success, content] = file.load_contents(null);
    if (!success || !content) {
      return [];
    }

    const contentStr = new TextDecoder().decode(content);

    // Handle potential JSON parsing issues
    let data;
    try {
      data = JSON.parse(contentStr);
    } catch (parseError) {
      console.error("Failed to parse clipboard JSON:", parseError);
      return [];
    }

    // Handle different clipboard data structures
    let items: ClipboardItem[] = [];

    if (Array.isArray(data)) {
      // Data is already an array
      items = data.filter(
        (item: any) =>
          item && typeof item === "object" && typeof item.value === "string",
      );
    } else if (data && typeof data === "object") {
      // Data might be an object with an array property
      const dataObj = data as any;
      if (dataObj.clipboardHistory && Array.isArray(dataObj.clipboardHistory)) {
        items = dataObj.clipboardHistory.filter(
          (item: any) =>
            item && typeof item === "object" && typeof item.value === "string",
        );
      } else if (dataObj.clipboard && Array.isArray(dataObj.clipboard)) {
        items = dataObj.clipboard.filter(
          (item: any) =>
            item && typeof item === "object" && typeof item.value === "string",
        );
      } else if (dataObj.history && Array.isArray(dataObj.history)) {
        items = dataObj.history.filter(
          (item: any) =>
            item && typeof item === "object" && typeof item.value === "string",
        );
      }
    }

    // Limit to last 20 items
    items = items.slice(0, 20);

    // Cache the results
    cachedClipboard = items;
    clipboardCacheTime = now;

    return cachedClipboard;
  } catch (error) {
    console.error("Failed to read clipboard history:", error);
    return [];
  }
}

function searchClipboard(query: string): SearchResult[] {
  const items = readClipboardHistory();
  const results: SearchResult[] = [];
  const searchTerm = query.toLowerCase();

  items.forEach((item, index) => {
    if (!item.value || typeof item.value !== "string") return;

    const content = item.value.toLowerCase();
    // If no query, show all items, otherwise filter
    if (query === "" || content.includes(searchTerm)) {
      const displayContent =
        item.value.length > 50
          ? `${item.value.substring(0, 50)}...`
          : item.value;

      const timeAgo = new Date(item.recorded).toLocaleString();

      results.push({
        type: "clipboard",
        title: displayContent.replace(/\n/g, " "),
        subtitle: `Copied ${timeAgo}`,
        icon: "edit-paste",
        data: {
          content: item.value,
          recorded: item.recorded,
          index,
        },
      });
    }
  });

  return results.slice(0, 5); // Limit clipboard results
}

function cleanup() {
  cleanupMonitor();
  apps = null;
  cachedApps = [];
  pendingChanges = 0;
  cachedClipboard = [];
  clipboardCacheTime = 0;
}

const text = Variable("");
export const WINDOW_NAME = "app-launcher";

function hide() {
  App.get_window(WINDOW_NAME)?.set_visible(false);
}

// Enhanced search function
function enhancedSearch(query: string): SearchResult[] {
  const results: SearchResult[] = [];

  if (!query) {
    // Return apps when no query
    return cachedApps.slice(0, 10).map((app) => ({
      type: "app" as const,
      title: app.name,
      subtitle: app.description || "",
      icon: app.iconName || "application-x-executable",
      data: app,
    }));
  }

  const isAction = query.startsWith(">");
  const isDir = query.startsWith("/") || query.startsWith("~");
  const isAI = query.startsWith("ai:") || query.startsWith("ask:");
  const isClip = query.startsWith("c:");

  // Math calculations
  if (couldBeMath(query)) {
    try {
      const mathExpression = query
        .replace(/\^/g, "**")
        .replace(/π/g, "Math.PI")
        .replace(/e/g, "Math.E");
      // Use Function constructor for safer evaluation
      const result = new Function("return " + mathExpression)();
      results.push({
        type: "math",
        title: result.toString(),
        subtitle: "Click to copy result to clipboard",
        icon: "accessories-calculator",
        data: { result, expression: query },
      });
    } catch {
      // Math evaluation failed, ignore
    }
  }

  // Directory search
  if (isDir) {
    const dirResults = ls({ path: query, silent: true });
    dirResults.slice(0, 5).forEach((item) => {
      results.push({
        type: "directory",
        title: item.name,
        subtitle: item.parentPath,
        icon: item.icon,
        data: item,
      });
    });
  }

  // AI Search - Perplexity integration
  if (isAI) {
    const aiQuery = query.replace(/^(ai:|ask:)\s*/, "");
    if (aiQuery.trim()) {
      results.push({
        type: "ai",
        title: "Ask AI",
        subtitle: `Search "${aiQuery}" with Perplexity AI`,
        icon: "preferences-system-search",
        data: { query: aiQuery },
      });
    }
  }

  // Clipboard search with prefix
  if (isClip) {
    const clipQuery = query.replace(/^c:\s*/, "");
    if (clipQuery.trim().length > 1) {
      const clipboardResults = searchClipboard(clipQuery);
      results.push(...clipboardResults);
    } else {
      // Show recent clipboard items when just "c:" is typed
      try {
        const clipboardResults = searchClipboard("");
        results.push(...clipboardResults.slice(0, 5));
      } catch (error) {
        console.error("Error loading clipboard items:", error);
      }
    }
  }

  // Custom actions
  if (isAction) {
    results.push({
      type: "action",
      title: "Action",
      subtitle: query,
      icon: "system-run",
      data: { command: query },
    });
  }

  // Command execution
  if (!isAction && !hasUnterminatedBackslash(query)) {
    const firstWord = query.split(" ")[0];
    const commandExists =
      exec(`bash -c "command -v ${firstWord}"`).trim() !== "";
    if (commandExists) {
      results.push({
        type: "command",
        title: "Run Command",
        subtitle: query,
        icon: query.startsWith("sudo")
          ? "dialog-password"
          : "utilities-terminal",
        data: { command: query, terminal: query.startsWith("sudo") },
      });
    }
  }

  // App search
  if (!apps) {
    if (!initializeApps()) {
      return results;
    }
  }

  const q = query.toLowerCase();
  function score(app: AstalApps.Application) {
    try {
      const name = app.name?.toLowerCase() || "";
      const desc = app.description?.toLowerCase() || "";
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.includes(q)) return 2;
      if (desc.includes(q)) return 3;
      return 99;
    } catch (error) {
      console.error("Error scoring app:", error);
      return 99;
    }
  }

  try {
    const appResults = cachedApps
      .map((app) => ({ app, s: score(app) }))
      .filter(({ s }) => s < 99)
      .sort((a, b) => a.s - b.s)
      .slice(0, 5)
      .map(({ app }) => ({
        type: "app" as const,
        title: app.name,
        subtitle: app.description || "",
        icon: app.iconName || "application-x-executable",
        data: app,
      }));

    results.push(...appResults);
  } catch (error) {
    console.error("Error in app search:", error);
  }

  // Clipboard search (only for non-prefix searches)
  if (!isAction && !isDir && !isAI && !isClip && query.length > 2) {
    const clipboardResults = searchClipboard(query);
    results.push(...clipboardResults);
  }

  // Web search and AI search fallbacks
  if (!isAction && !isDir && !isAI && !isClip && results.length < 3) {
    const isQuestion =
      /^(what|how|why|when|where|who|can|should|will|is|are|do|does|did|which)\s/i.test(
        query,
      ) ||
      query.includes("?") ||
      query.split(" ").length > 3;

    if (isQuestion) {
      results.push({
        type: "ai",
        title: "Ask AI",
        subtitle: `Ask "${query}" using Perplexity AI`,
        icon: "preferences-system-search",
        data: { query },
      });
    }

    results.push({
      type: "web",
      title: "Search the web",
      subtitle: query,
      icon: "web-browser",
      data: { query },
    });
  }

  return results;
}

function executeSearchResult(result: SearchResult) {
  hide();

  switch (result.type) {
    case "app":
      launchAppDetached(result.data);
      break;

    case "math":
      // Copy result to clipboard
      execAsync(["wl-copy", result.data.result.toString()]).catch(() => {
        // Fallback for X11 - pipe the result to xclip
        const resultStr = result.data.result.toString();
        exec(`echo "${resultStr}" | xclip -selection clipboard`);
      });
      break;

    case "directory":
      execAsync([
        "xdg-open",
        `${result.data.parentPath}/${result.data.name}`,
      ]).catch(console.error);
      break;

    case "command":
      // Use our terminal popup for all commands
      runCommandInTerminal(result.data.command);
      break;

    case "action":
      // Handle custom actions using terminal popup
      const command = result.data.command.substring(1); // Remove '>'
      runCommandInTerminal(command);
      break;

    case "web":
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(result.data.query)}`;
      execAsync(["xdg-open", searchUrl]).catch(console.error);
      break;

    case "ai":
      const aiSearchUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(result.data.query)}`;
      execAsync(["xdg-open", aiSearchUrl]).catch(console.error);
      break;

    case "clipboard":
      // Copy the clipboard item back to clipboard
      execAsync(["wl-copy", result.data.content]).catch(() => {
        // Fallback for X11
        const content = result.data.content.replace(/"/g, '\\"');
        exec(`echo "${content}" | xclip -selection clipboard`);
      });
      break;
  }
}

function launchAppDetached(app: AstalApps.Application) {
  try {
    app.launch();
    print("App launched: %s\n", app.name);
  } catch (error) {
    try {
      console.log(error);
      if (app.executable) {
        const success = GLib.spawn_command_line_async(
          `nohup ${app.executable}`,
        );
        if (success) {
          print("App launched via spawn_async: %s\n", app.name);
        } else {
          throw new Error("spawn_async failed");
        }
      } else {
        throw new Error("No executable found");
      }
    } catch (finalError) {
      print("Failed to launch app: %s - %s\n", app.name, finalError);
      throw finalError;
    }
  }
}

function SearchIcon({
  result,
  size = 32,
}: {
  result: SearchResult;
  size?: number;
}) {
  try {
    if (result.icon) {
      try {
        // Try to parse as Gio.Icon (works for theme icons and absolute paths)
        const gicon = Gio.icon_new_for_string(result.icon) as Gio.Icon;
        return <image gicon={gicon} pixelSize={size} />;
      } catch {
        try {
          // Fallback: try to create icon from file path
          const gicon = Gio.Icon.new_for_string(result.icon) as Gio.Icon;
          return <image gicon={gicon} pixelSize={size} />;
        } catch (e) {
          console.error(`Failed to load icon ${result.icon}:`, e);
        }
      }
    }
  } catch (e) {
    console.error(`SearchIcon error:`, e);
  }

  // fallback: generic icon based on type
  const fallbackIcon =
    {
      app: "application-x-executable",
      math: "accessories-calculator",
      directory: "folder",
      command: "utilities-terminal",
      web: "web-browser",
      action: "system-run",
      ai: "preferences-system-search",
      clipboard: "edit-paste",
    }[result.type] || "application-x-executable";

  return <image iconName={fallbackIcon} pixelSize={size} />;
}

function MathResultButton({ result }: { result: SearchResult }) {
  const expression = result.data.expression;
  const resultValue = result.data.result.toString();

  return (
    <button
      cssClasses={["app-button", "math-result"]}
      onClicked={() => executeSearchResult(result)}
      child={
        <box vertical spacing={8}>
          <box spacing={12} halign={Gtk.Align.CENTER}>
            <label
              cssClasses={["math-expression"]}
              label={expression}
              xalign={0.5}
            />
            <image iconName="go-next-symbolic" pixelSize={24} />
            <label
              cssClasses={["math-result"]}
              label={resultValue}
              xalign={0.5}
            />
          </box>
          <label
            cssClasses={["description"]}
            label={result.subtitle}
            xalign={0.5}
          />
        </box>
      }
    />
  );
}

function ClipboardResultButton({ result }: { result: SearchResult }) {
  const content = result.data.content;
  const isLongText = content.length > 100;
  const preview = isLongText ? content.substring(0, 100) + "..." : content;

  return (
    <button
      cssClasses={["app-button", "clipboard-result"]}
      onClicked={() => executeSearchResult(result)}
      child={
        <box spacing={12}>
          <SearchIcon result={result} size={24} />
          <box vertical spacing={4} vexpand>
            <label
              cssClasses={["clipboard-preview"]}
              label={preview.replace(/\n/g, " ")}
              ellipsize={Pango.EllipsizeMode.END}
              maxWidthChars={40}
              xalign={0}
              wrap
            />
            <label
              cssClasses={["description"]}
              label={result.subtitle}
              ellipsize={Pango.EllipsizeMode.END}
              xalign={0}
            />
          </box>
        </box>
      }
    />
  );
}

function SearchResultButton({ result }: { result: SearchResult }) {
  if (result.type === "math") {
    return <MathResultButton result={result} />;
  }

  if (result.type === "clipboard") {
    return <ClipboardResultButton result={result} />;
  }

  return (
    <button
      cssClasses={["app-button"]}
      onClicked={() => executeSearchResult(result)}
      child={
        <box spacing={8}>
          <SearchIcon result={result} size={32} />
          <box valign={Gtk.Align.CENTER} vertical>
            <label
              cssClasses={["name"]}
              ellipsize={Pango.EllipsizeMode.END}
              xalign={0}
              label={result.title}
            />

            {result.subtitle ? (
              <label
                cssClasses={["description"]}
                ellipsize={Pango.EllipsizeMode.END}
                maxWidthChars={24}
                wrap
                xalign={0}
                label={result.subtitle}
              />
            ) : (
              <box />
            )}
          </box>
        </box>
      }
    />
  );
}

function SearchEntry() {
  const onEnter = () => {
    const results = enhancedSearch(text.get());
    if (results && results.length > 0) {
      try {
        executeSearchResult(results[0]);
      } catch (error) {
        console.error("Failed to execute search result:", error);
        // Try to reinitialize on error
        initializeApps();
      }
    }
  };

  return (
    <overlay
      cssClasses={["entry-overlay"]}
      heightRequest={60}
      child={
        <entry
          type="overlay"
          vexpand
          marginBottom={10}
          primaryIconName={"system-search-symbolic"}
          placeholderText="Search..."
          text={text.get()}
          setup={(self) => {
            hook(self, App, "window-toggled", (_, win) => {
              const winName = win.name;
              const visible = win.visible;
              if (winName == WINDOW_NAME && visible) {
                // Ensure apps are loaded when window opens
                if (!apps || cachedApps.length === 0) {
                  initializeApps();
                }
                text.set("");
                self.set_text("");
                self.grab_focus();
              }
            });
          }}
          onChanged={(self) => text.set(self.text)}
          onActivate={onEnter}
        />
      }
    />
  );
}

function SearchResultsWindow() {
  const results = text((text) => enhancedSearch(text));

  return (
    <Gtk.ScrolledWindow
      marginTop={10}
      vexpand
      child={
        <box
          spacing={6}
          vertical
          child={
            <>
              {results.as((results) =>
                results
                  ? results.map((result) => (
                      <SearchResultButton result={result} />
                    ))
                  : null,
              )}

              <box
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                cssClasses={["not-found"]}
                vertical
                vexpand
                visible={results.as((r) => !r || r.length === 0)}
                child={
                  <>
                    <image
                      iconName="system-search-symbolic"
                      iconSize={Gtk.IconSize.LARGE}
                    />
                    <label label="No match found" />
                  </>
                }
              />
            </>
          }
        />
      }
    />
  );
}

export default function Applauncher() {
  setupAppsFolderMonitor();
  reloadAppsCache();

  return (
    <PopupWindow
      name={WINDOW_NAME}
      setup={(self) => {
        self.connect("close-request", () => {
          cleanup();
        });
      }}
      margin={10}
      onDestroy={() => {
        layout.drop();
        cleanup();
      }}
      layout="top_center"
      child={
        <box
          cssClasses={["applauncher-container"]}
          vertical
          vexpand={false}
          child={
            <>
              <SearchEntry />
              <SearchResultsWindow />
            </>
          }
        />
      }
    />
  );
}
