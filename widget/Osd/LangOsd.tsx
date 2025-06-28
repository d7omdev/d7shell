import { bind, timeout, Variable } from "astal";
import { Astal, Gtk } from "astal/gtk4";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
import Window from "../../common/PopupWindow";
import MaterialIcon from "../../common/MaterialIcon";

const WINDOW_NAME = "lang-osd";
const TIMEOUT = 2000;
const lang = Variable<string>("English");

const hyprland = AstalHyprland.get_default();

function LangOsd() {
  return (
    <box
      cssClasses={["px-10", "py-1", "pb-2", "osd-lang"]}
      orientation={Gtk.Orientation.VERTICAL}
      spacing={2}
    >
      <MaterialIcon iconName="translate" size="hugerass" />
      <label cssClasses={["txt-large"]} label={bind(lang)} />
    </box>
  );
}

export default function OSD() {
  let windowRef: Astal.Window;

  const onShow = () => {
    if (windowRef) {
      windowRef.set_visible(true);
    }
  };

  const onHide = () => {
    if (windowRef) {
      windowRef.set_visible(false);
    }
  };

  hyprland.connect(
    "keyboard-layout",
    (_: unknown, kbName: string, layoutName: string) => {
      if (!kbName) {
        return;
      }
      onShow();
      lang.set(
        layoutName.toLowerCase().includes("english")
          ? "English"
          : layoutName.charAt(0).toUpperCase() +
              layoutName.slice(1).toLowerCase(),
      );
      timeout(TIMEOUT, () => {
        onHide();
      });
    },
  );

  return (
    <Window
      name={WINDOW_NAME}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={Astal.WindowAnchor.BOTTOM}
      keymode={Astal.Keymode.NONE}
      visible={false}
      defaultWidth={-1}
      margin_bottom={10}
      margin_top={5}
      setup={(self) => {
        windowRef = self;
      }}
      child={<LangOsd />}
    />
  );
}
