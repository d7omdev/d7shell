import { Variable, bind } from "astal";
import AstalHyprland from "gi://AstalHyprland?version=0.1";
// import PanelButton from "../PanelButton";
import BarItem from "../BarItem";

const layoutMap: Record<string, string> = {
  English: "en",
  Arabic: "ar",
  english: "en",
  arabic: "ar",
};

function getLayout(layoutName: string): string {
  for (const [key, value] of Object.entries(layoutMap)) {
    if (layoutName.includes(key)) {
      return value;
    }
  }

  const match = layoutName.match(/\(([A-Za-z]{2})\)/);
  if (match) {
    return match[1].toLowerCase();
  }

  return "?";
}

export default function KeyboardLayout() {
  const keyboardLayout = Variable("en");
  const hyprland = AstalHyprland.get_default();

  hyprland.connect("keyboard-layout", (_, kbName, layoutName) => {
    if (!kbName) {
      return;
    }
    const layoutCode = getLayout(layoutName);
    keyboardLayout.set(layoutCode);
  });

  return (
    <BarItem
      margin_end={4}
      child={
        <label label={bind(keyboardLayout)} cssClasses={["keyboard-layout"]} />
      }
    />
  );
}
