import { execAsync, GLib } from "astal";
import { mkOptions, opt } from "./lib/option";
import { gsettings } from "./lib/utils";

const options = mkOptions(`${GLib.get_user_config_dir()}/ags/config.json`, {
  wallpaper: {
    // folder: opt(`${GLib.get_home_dir()}/Pictures/Star`, { cached: true }),
    folder: opt(`${GLib.get_home_dir()}/Downloads/Images/Wallpapers`, {
      cached: true,
    }),
    current: opt(
      await execAsync("swww query")
        .then((out) => out.split("image:")[1].trim())
        .catch(() => ""),
      { cached: true },
    ),
  },
  screencorners: {
    radius: 20,
  },
  bar: {
    position: opt("top"),
    separator: opt(true),
    start: opt(["launcher", "workspaces", "activeapps"]),
    center: opt(["time"]),
    end: opt([
      "recordbutton",
      "network_speed",
      "tray",
      "quicksetting",
      "powermenu",
    ]),
    workspacses: {
      count: opt(5),
    },
    datetime: {
      dateFormat: opt("%a  %m/%d"),
      timeFormat: opt("%I:%M %p"),
    },
  },
  theme: {
    mode: opt(
      gsettings.get_string("color-scheme") == "prefer-light" ? "light" : "dark",
      { cached: true },
    ),
  },
});

export default options;
