import { Astal, Gtk, Gdk } from "astal/gtk4";
import Powermenu from "../../lib/powermenu";
import PopupWindow from "../../common/PopupWindow";
import { FlowBox } from "../../common/FlowBox";
import { timeout, Variable } from "astal";
import { bind } from "astal";

const powermenu = Powermenu.get_default();
export const WINDOW_NAME = "powermenu";

const icons = {
  sleep: "weather-clear-night-symbolic",
  reboot: "system-reboot-symbolic",
  logout: "system-log-out-symbolic",
  shutdown: "system-shutdown-symbolic",
  lockscreen: "system-lock-screen-symbolic",
};

type Action = keyof typeof icons;

function SysButton({ action, label }: { action: Action; label: string }) {
  const showTitle = Variable(false);
  return (
    <button
      cssClasses={["system-button"]}
      onClicked={() => powermenu.action(action)}
      child={
        <box
          vertical
          spacing={12}
          halign={Gtk.Align.CENTER}
          valign={Gtk.Align.CENTER}
          onHoverEnter={() => showTitle.set(true)}
          onHoverLeave={() => timeout(250, () => showTitle.set(false))}
        >
          <image
            iconName={icons[action]}
            iconSize={Gtk.IconSize.LARGE}
            valign={Gtk.Align.CENTER}
            halign={Gtk.Align.CENTER}
            marginTop={12}
          />
          <revealer
            transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
            valign={Gtk.Align.END}
            halign={Gtk.Align.CENTER}
            reveal_child={bind(showTitle)}
            child={<label label={label} />}
          />
        </box>
      }
    />
  );
}

export default function PowerMenu(_gdkmonitor: Gdk.Monitor) {
  return (
    <PopupWindow
      name={WINDOW_NAME}
      exclusivity={Astal.Exclusivity.IGNORE}
      layout="center"
      child={
        <box
          child={
            // @ts-ignore
            <FlowBox
              cssClasses={["powermenu-container"]}
              rowSpacing={6}
              columnSpacing={6}
              maxChildrenPerLine={4}
              setup={(self) => {
                self.connect("child-activated", (_, child) => {
                  child.get_child()?.activate();
                });
              }}
            >
              <SysButton action={"sleep"} label={"Sleep"} />
              <SysButton action={"logout"} label={"Log Out"} />
              <SysButton action={"reboot"} label={"Reboot"} />
              <SysButton action={"shutdown"} label={"Shutdown"} />
            </FlowBox>
          }
        />
      }
    />
  );
}
