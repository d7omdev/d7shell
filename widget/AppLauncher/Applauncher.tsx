import { App, Gtk, hook } from "astal/gtk4";
import { Variable } from "astal";
import Pango from "gi://Pango";
import AstalApps from "gi://AstalApps";
import PopupWindow from "../../common/PopupWindow";
import { Gio, GLib } from "astal";
import options from "../../option";
import { runCommandInTerminal } from "../Terminal/TerminalPopup";
import {
  SearchResult,
  execAsync,
  exec,
  getAppDirectories,
} from "../../lib/appLauncherUtils";
import { enhancedSearch } from "../../lib/searchUtils";

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

let apps: AstalApps.Apps | null = null;
let cachedApps: AstalApps.Application[] = [];
let appsMonitors: Gio.FileMonitor[] = [];
let reloadTimeout: number | null = null;
let pendingChanges = 0;
const RELOAD_THROTTLE_MS = 2000;

function initializeApps() {
  try {
    if (apps) {
      apps = null;
    }

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
  cleanupMonitor();

  const significantChangeTypes = [
    Gio.FileMonitorEvent.CREATED,
    Gio.FileMonitorEvent.DELETED,
    Gio.FileMonitorEvent.RENAMED,
    Gio.FileMonitorEvent.CHANGED,
  ];

  getAppDirectories().forEach((dirPath) => {
    try {
      const appsFolder = Gio.File.new_for_path(dirPath);

      if (!appsFolder.query_exists(null)) {
        return;
      }

      const monitor = appsFolder.monitor_directory(
        Gio.FileMonitorFlags.WATCH_MOVES,
        null,
      );

      monitor.connect("changed", (_monitor, file, _otherFile, eventType) => {
        const filePath = file?.get_path() || "";

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
    try {
      GLib.source_remove(reloadTimeout);
    } catch (error) {
      console.error("Error removing timeout source:", error);
    }
    reloadTimeout = null;
  }
}

function cleanup() {
  cleanupMonitor();
  apps = null;
  cachedApps = [];
  pendingChanges = 0;
}

const text = Variable("");
export const WINDOW_NAME = "app-launcher";

function hide() {
  App.get_window(WINDOW_NAME)?.set_visible(false);
}

function executeSearchResult(result: SearchResult) {
  hide();

  switch (result.type) {
    case "app":
      result.data.launch();
      break;

    case "math":
      execAsync(["wl-copy", result.data.result.toString()]).catch(() => {
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
      runCommandInTerminal(result.data.command);
      break;

    case "action":
      const command = result.data.command.substring(1);
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
      execAsync(["wl-copy", result.data.content]).catch(() => {
        const content = result.data.content.replace(/"/g, '\\"');
        exec(`echo "${content}" | xclip -selection clipboard`);
      });
      break;

    case "emoji":
      execAsync(["wl-copy", result.data.emoji]).catch(() => {
        exec(`echo "${result.data.emoji}" | xclip -selection clipboard`);
      });
      break;
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
        const gicon = Gio.icon_new_for_string(result.icon) as Gio.Icon;
        return <image gicon={gicon} pixelSize={size} />;
      } catch {
        try {
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
      emoji: "face-smile",
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
  const isLongText = content.length > 60;
  const preview = isLongText ? content.substring(0, 60) + "..." : content;

  return (
    <button
      cssClasses={["app-button", "clipboard-result"]}
      onClicked={() => executeSearchResult(result)}
      child={
        <box spacing={6} heightRequest={44}>
          <SearchIcon result={result} size={18} />
          <box vertical spacing={2}>
            <label
              cssClasses={["clipboard-preview"]}
              label={preview.replace(/\n/g, " ")}
              ellipsize={Pango.EllipsizeMode.END}
              maxWidthChars={35}
              xalign={0}
              lines={2}
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

function EmojiResultButton({ result }: { result: SearchResult }) {
  return (
    <button
      cssClasses={["app-button", "emoji-result"]}
      onClicked={() => executeSearchResult(result)}
      child={
        <box spacing={0}>
          <label
            cssClasses={["emoji-display"]}
            label={result.data.emoji}
            xalign={0.5}
          />
          <box vertical spacing={2}>
            <label
              cssClasses={["emoji-name"]}
              label={result.data.name}
              ellipsize={Pango.EllipsizeMode.END}
              xalign={0}
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

  if (result.type === "emoji") {
    return <EmojiResultButton result={result} />;
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
    const results = enhancedSearch(text.get(), cachedApps);
    if (results && results.length > 0) {
      try {
        executeSearchResult(results[0]);
      } catch (error) {
        console.error("Failed to execute search result:", error);
        initializeApps();
      }
    }
  };

  return (
    <overlay
      cssClasses={["entry-overlay"]}
      child={
        <entry
          primaryIconName={"system-search-symbolic"}
          placeholderText="Search..."
          text={text.get()}
          setup={(self) => {
            hook(self, App, "window-toggled", (_, win) => {
              const winName = win.name;
              const visible = win.visible;
              if (winName == WINDOW_NAME && visible) {
                if (!apps || cachedApps.length === 0) {
                  initializeApps();
                }
                text.set("");
                self.set_text("");
                self.grab_focus();

                // self.connect("focus-out-event", () => {
                //   return false;
                // });
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
  const results = text((text) => enhancedSearch(text, cachedApps));

  return (
    <Gtk.ScrolledWindow
      propagateNaturalHeight
      vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      hscrollbarPolicy={Gtk.PolicyType.NEVER}
      child={
        <box
          spacing={2}
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
          return false;
        });
      }}
      onDestroy={() => {
        layout.drop();
        cleanup();
      }}
      layout="top_center"
      child={
        <box
          cssClasses={["applauncher-container"]}
          vertical
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
