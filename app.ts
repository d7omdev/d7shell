import { App, Gdk } from "astal/gtk4";
import { GLib } from "astal";
import style from "./style/main.scss";
import windows from "./windows";
import { monitorColorsChange } from "./lib/utils";
import initHyprland from "./lib/hyprland";
// import { handleMessage } from "./lib/message";

// const DATA = GLib.build_filenamev([GLib.get_home_dir(), ".config", "ags"]);
const DATA = GLib.build_filenamev([GLib.get_home_dir(), "Projects", "d7shell"]);

// Helper to show windows on a specific monitor by index
function forMonitor(
  index: number,
  windows: Array<(monitor: Gdk.Monitor) => unknown>,
) {
  const monitors = App.get_monitors();
  const monitor = monitors[index] ? monitors[index] : monitors[0];
  if (monitor) {
    windows.forEach((win) => win(monitor));
  }
}

App.start({
  icons: `${DATA}/icons`,
  css: style,
  main() {
    forMonitor(1, windows as Array<(monitor: Gdk.Monitor) => unknown>);
    monitorColorsChange();
    initHyprland();
  },
  // requestHandler(request, res) {
  //   handleMessage(request, res);
  // },
});
