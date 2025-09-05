import { timeout, Variable } from "astal";
import { Astal, Gdk, Gtk } from "astal/gtk4";
import { FlowBox } from "../../common/FlowBox";
import PopupWindow from "../../common/PopupWindow";
import Powermenu from "../../lib/powermenu";

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
const showTitle = Variable(false);
const Label = Variable("");

function SysButton({ action, label }: { action: Action; label: string }) {
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
          onHoverEnter={() => {
            showTitle.set(true);
            Label.set(label);
          }}
          onHoverLeave={() => {
            timeout(250, () => showTitle.set(false));
          }}
          child={
            <image
              iconName={icons[action]}
              iconSize={Gtk.IconSize.LARGE}
              valign={Gtk.Align.CENTER}
              halign={Gtk.Align.CENTER}
            />
          }
        />
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
          vertical
          child={
            <>
              {/*  @ts-ignore */}
              <FlowBox
                cssClasses={["powermenu-container"]}
                rowSpacing={6}
                columnSpacing={6}
                maxChildrenPerLine={5}
                margin_bottom={20}
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
                <SysButton action={"lockscreen"} label={"Lock"} />
              </FlowBox>
              {/* <revealer */}
              {/*   transitionType={Gtk.RevealerTransitionType.SLIDE_UP} */}
              {/*   cssClasses={["powermenu-title"]} */}
              {/*   valign={Gtk.Align.END} */}
              {/*   halign={Gtk.Align.CENTER} */}
              {/*   reveal_child={bind(showTitle)} */}
              {/*   visible={bind(showTitle)} */}
              {/*   child={<label label={bind(Label)} />} */}
              {/* /> */}
            </>
          }
        />
      }
    />
  );
}
