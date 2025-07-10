import { bind } from "astal";
import { Gio } from "astal";
import Battery from "gi://AstalBattery";
import PanelButton from "../PanelButton";
import BarItem, { BarItemStyle } from "../BarItem";
import { notifySend } from "../../../lib/notifications";

export default () => {
  const bat = Battery.get_default();
  bind(bat, "percentage").as((p) => {
    print("battery", p);
    switch (p) {
      case 20:
        notifySend({
          appName: "Battery",
          appIcon: "battery-level-20-symbolic",
          summary: "Batter is going low!",
          body: "Battery is at 20%, consider recharging!",
        });
        break;
      case 10:
        notifySend({
          appName: "Battery",
          appIcon: "battery-level-10-symbolic",
          summary: "Plug the charger already!!!",
          body: "Battery is at 10%, plug the charger now!!",
        });
        break;
      case 5:
        notifySend({
          appName: "Battery",
          appIcon: "battery-level-0-symbolic",
          summary: "ARE YOU KIDDING ME!!!",
          body: "Charge or im going to sleep, thats the last warning!",
        });
        break;
      case 1:
        notifySend({
          appName: "Battery",
          appIcon: "gnome-power-manager-symbolic",
          summary: "FU I'm going to sleep...",
          body: "Cyya loser",
        });
        break;

      default:
        break;
    }
  });

  return (
    <PanelButton
      cssClasses={["bar__battery"]}
      visible={bind(bat, "isPresent")}
      child={
        <box spacing={4}>
          <image
            gicon={bind(bat, "battery_icon_name").as((iconName) =>
              Gio.ThemedIcon.new(iconName),
            )}
          />
          <label
            label={bind(bat, "percentage").as(
              (p) => `${Math.floor(p * 100)} %`,
            )}
          />
        </box>
      }
    />
  );
};
