import { App, Gtk, hook } from "astal/gtk4";
import { Variable } from "astal";
import Pango from "gi://Pango";
import AstalApps from "gi://AstalApps";
import PopupWindow from "../../common/PopupWindow";
import { Gio, GLib } from "astal";
import options from "../../option";
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

// --- Fast fuzzy search with error handling ---
function simpleFuzzySearch(query: string): AstalApps.Application[] {
  // Ensure we have a valid apps instance
  if (!apps) {
    if (!initializeApps()) {
      return [];
    }
  }

  if (!query) return cachedApps;

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
    return cachedApps
      .map((app) => ({ app, s: score(app) }))
      .filter(({ s }) => s < 99)
      .sort((a, b) => a.s - b.s)
      .map(({ app }) => app);
  } catch (error) {
    console.error("Error in fuzzy search:", error);
    return [];
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

function AppButton({ app }: { app: AstalApps.Application }) {
  return (
    <button
      cssClasses={["app-button"]}
      onClicked={() => {
        hide();
        print("Launching app: %s\n", app.name);
        try {
          launchAppDetached(app);
          print("App launch initiated: %s\n", app.name);
        } catch (error) {
          print("Failed to launch app: %s - %s\n", app.name, error);
          // Try to reinitialize apps on launch failure
          initializeApps();
        }
      }}
      child={
        <box
          spacing={8}
          child={
            <>
              <image iconName={app.iconName} pixelSize={32} />
              <box
                valign={Gtk.Align.CENTER}
                vertical
                child={
                  <>
                    <label
                      cssClasses={["name"]}
                      ellipsize={Pango.EllipsizeMode.END}
                      xalign={0}
                      label={app.name}
                    />
                    {app.description && (
                      <label
                        cssClasses={["description"]}
                        ellipsize={Pango.EllipsizeMode.END}
                        maxWidthChars={24}
                        wrap
                        xalign={0}
                        label={app.description}
                      />
                    )}
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

function SearchEntry() {
  const onEnter = () => {
    const results = simpleFuzzySearch(text.get());
    if (results && results.length > 0) {
      try {
        launchAppDetached(results[0]);
        hide();
      } catch (error) {
        console.error("Failed to launch app from search:", error);
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

function AppsScrolledWindow() {
  const list = text((text) => simpleFuzzySearch(text));
  return (
    <Gtk.ScrolledWindow
      vexpand
      child={
        <box
          spacing={6}
          vertical
          child={
            <>
              {list.as((list) =>
                list ? list.map((app) => <AppButton app={app} />) : [],
              )}
              <box
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                cssClasses={["not-found"]}
                vertical
                vexpand
                visible={list.as((l) => !l || l.length === 0)}
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
              <AppsScrolledWindow />
            </>
          }
        />
      }
    />
  );
}
