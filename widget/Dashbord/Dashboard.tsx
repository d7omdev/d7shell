import { App, Gtk } from "astal/gtk4";
import { formatTime, time, uptime } from "../../lib/utils";
import AstalNotifd from "gi://AstalNotifd";
import PopupWindow from "../../common/PopupWindow";
import Notification from "../Notifactions/Notification";
import { WeatherPanel } from "./Weather";
import { SystemInfo } from "./SystemInfo";
import { bind, Variable } from "astal";
import options from "../../option";
import { Switch } from "astal/gtk4/widget";

export const WINDOW_NAME = "dashboard";
const notifd = AstalNotifd.get_default();

const { bar } = options;

const layout = Variable.derive(
  [bar.position, bar.start, bar.center, bar.end],
  (pos, start, center, end) => {
    if (start.includes("time")) return `${pos}_left`;
    if (center.includes("time")) return `${pos}_center`;
    if (end.includes("time")) return `${pos}_right`;

    return `${pos}_center`;
  },
);

/**
 * Scrolled window component for displaying notifications
 */
function NotifsScrolledWindow() {
  return (
    <Gtk.ScrolledWindow
      vexpand
      child={
        <box
          vertical
          hexpand={false}
          vexpand={false}
          spacing={8}
          orientation={Gtk.Orientation.VERTICAL}
          child={
            <>
              {bind(notifd, "notifications").as((notifs) =>
                notifs.map((notification) => (
                  <revealer
                    revealChild={true}
                    transitionDuration={300}
                    transitionType={Gtk.RevealerTransitionType.CROSSFADE}
                    child={
                      <Notification n={notification} showActions={false} />
                    }
                  />
                )),
              )}
              <box
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                cssClasses={["not-found"]}
                vertical
                vexpand
                visible={bind(notifd, "notifications").as(
                  (n) => n.length === 0,
                )}
                spacing={6}
                child={
                  <>
                    <image
                      iconName="notification-disabled-symbolic"
                      pixelSize={50}
                    />
                    <label
                      label="Your inbox is empty"
                      cssClasses={["labelSmallBold"]}
                    />
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

/**
 * Do Not Disturb toggle button component
 */
function DNDButton() {
  return (
    <box
      spacing={6}
      child={
        <>
          <label label="Do Not Disturb" />
          <Switch
            heightRequest={10}
            active={bind(notifd, "dont_disturb")}
            onStateSet={(self, state) => {
              self.set_state(state);
              notifd.set_dont_disturb(state);
            }}
            halign={Gtk.Align.CENTER}
          />
        </>
      }
    />
  );
}

/**
 * Clear all notifications button component
 */
function ClearButton() {
  return (
    <button
      cssClasses={["clear"]}
      halign={Gtk.Align.CENTER}
      onClicked={() => {
        notifd.notifications.forEach((n) => n.dismiss());
        App.toggle_window(WINDOW_NAME);
      }}
      sensitive={bind(notifd, "notifications").as((n) => n.length > 0)}
      child={
        <box
          spacing={6}
          child={
            <>
              <label label="Clear" />
              <image iconName="user-trash-full-symbolic" />
            </>
          }
        />
      }
    />
  );
}

/**
 * Main Dashboard component
 */
function Dashboard() {
  return (
    <PopupWindow
      name={WINDOW_NAME}
      layout="top_center"
      margin={10}
      onDestroy={() => layout.drop()}
      child={
        <box
          spacing={0}
          child={
            <>
              <box
                cssClasses={["notifications-container"]}
                vertical
                vexpand={false}
                child={
                  <>
                    <Gtk.Separator />
                    <NotifsScrolledWindow />
                    <box
                      cssClasses={["window-header"]}
                      child={
                        <>
                          <DNDButton />
                          <box hexpand />
                          <ClearButton />
                        </>
                      }
                    />
                  </>
                }
              />
              <box
                spacing={8}
                cssClasses={["datemenu-container"]}
                child={
                  <box
                    hexpand
                    vertical
                    halign={Gtk.Align.CENTER}
                    cssClasses={["dash-main"]}
                    child={
                      <>
                        <label
                          label={time((t) => t.format("%H:%M")!)}
                          halign={Gtk.Align.CENTER}
                          cssClasses={["time-label"]}
                        />
                        <box
                          halign={Gtk.Align.CENTER}
                          child={
                            <>
                              <label
                                label="uptime: "
                                cssClasses={["uptime-label"]}
                                xalign={0}
                              />
                              <label
                                label={uptime().as((seconds) =>
                                  formatTime(seconds),
                                )}
                                halign={Gtk.Align.CENTER}
                                cssClasses={["uptime-label"]}
                              />
                            </>
                          }
                        />
                        <Gtk.Calendar halign={Gtk.Align.CENTER} />
                        <WeatherPanel />
                        <SystemInfo />
                      </>
                    }
                  />
                }
              />
            </>
          }
        />
      }
    />
  );
}

export default function () {
  Dashboard();
}
