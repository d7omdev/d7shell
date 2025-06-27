import PanelButton from "../PanelButton";
import { WINDOW_NAME } from "../../AppLauncher/Applauncher";
import { App } from "astal/gtk4";

export default function LauncherPanelButton() {
  return (
    <PanelButton
      cssClasses={["applauncher-bg"]}
      margin_top={2}
      margin_bottom={2}
      window={WINDOW_NAME}
      onClicked={() => App.toggle_window(WINDOW_NAME)}
      child={<box child={<image iconName={"arch-symbolic"} />} />}
    />
  );
}
