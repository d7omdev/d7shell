import { Variable } from "astal";
import { execAsync } from "astal/process";
import QSButton from "../QSButton";

const warmColorsActive = Variable<boolean>(false);

export default function WarmColorsButton() {
  return (
    <QSButton
      iconName={warmColorsActive().as((v) =>
        v ? "weather-clear-night-symbolic" : "weather-clear-symbolic",
      )}
      label="Warm Colors"
      connection={[warmColorsActive, null, (v: unknown) => Boolean(v)]}
      onClicked={() => {
        if (warmColorsActive().get()) {
          execAsync("pkill gammastep").catch((err) =>
            logError(err, "Failed to kill gammastep"),
          );
          warmColorsActive.set(false);
          execAsync([
            "notify-send",
            "-i",
            "display",
            "Warm Colors",
            "Disabled",
          ]);
        } else {
          execAsync(["sh", "-c", "gammastep -O 3500 & disown"]).catch((err) =>
            logError(err, "Failed to start gammastep"),
          );
          warmColorsActive.set(true);
          execAsync(["notify-send", "-i", "display", "Warm Colors", "Enabled"]);
        }
      }}
    />
  );
}
