import { bind, Binding, execAsync, GObject, timeout, Variable } from "astal";
import { App, Astal, Gdk, Gtk } from "astal/gtk4";
import AstalBattery from "gi://AstalBattery";
import AstalBluetooth from "gi://AstalBluetooth";
import AstalNetwork from "gi://AstalNetwork";
import AstalWp from "gi://AstalWp?version=0.1";
import { FlowBox } from "../../common/FlowBox";
import PopupWindow from "../../common/PopupWindow";
import ScreenRecord from "../../lib/screenrecord";
import { bash, notifySend } from "../../lib/utils";
import options from "../../option";
import { toggleWallpaperPicker } from "../Wallpaperpicker/WallpaperPicker";
import BrightnessBox from "./BrightnessBox";
import DarkModeQS from "./buttons/DarkModeQS";
import DontDisturbQS from "./buttons/DontDisturbQS";
import MicQS from "./buttons/MicQS";
import RecordQS from "./buttons/RecordQS";
import MediaPlayers from "./MediaPlayer";
import BatteryPage from "./pages/BatteryPage";
import BluetoothPage from "./pages/BluetoothPage";
import MediaSourcesPage from "./pages/MediaSourcesPage";
import SpeakerPage from "./pages/SpeakerPage";
import WifiPage from "./pages/WifiPage";
import VolumeBox from "./VolumeBox";
import ToggleWarm from "./buttons/ToggleWarm";

export const WINDOW_NAME = "quicksettings";
export const qsPage = Variable("main");
const { bar } = options;

const layout = Variable.derive(
  [bar.position, bar.start, bar.center, bar.end],
  (pos, start, center, end) => {
    if (start.includes("quicksetting")) return `${pos}_left`;
    if (center.includes("quicksetting")) return `${pos}_center`;
    if (end.includes("quicksetting")) return `${pos}_right`;

    return `${pos}_center`;
  },
);

function QSButtons() {
  const wp = AstalWp.get_default();
  return (
    // @ts-ignore
    <FlowBox
      maxChildrenPerLine={2}
      activateOnSingleClick={false}
      homogeneous
      rowSpacing={6}
      columnSpacing={6}
    >
      {/* <DarkModeQS /> */}
      {/* <ColorPickerQS /> */}
      {/* <ScreenshotQS /> */}
      <MicQS />
      <DontDisturbQS />
      <ToggleWarm />
      {wp?.audio && <MediaSourcesArrowButton />}
      {/* <RecordQS /> */}
    </FlowBox>
  );
}
function QSButtons_child() {
  return (
    // @ts-ignore
    <FlowBox
      maxChildrenPerLine={2}
      activateOnSingleClick={false}
      homogeneous
      rowSpacing={6}
      columnSpacing={6}
    >
      <DarkModeQS />
      {/* <ColorPickerQS /> */}
      {/* <ScreenshotQS /> */}
      {/* <MicQS /> */}
      {/* <DontDisturbQS /> */}
      <RecordQS />
    </FlowBox>
  );
}

function Header() {
  const battery = AstalBattery.get_default();

  const screenRecord = ScreenRecord.get_default();
  return (
    <box hexpand cssClasses={["header"]} spacing={6}>
      <button
        cssClasses={["battery"]}
        onClicked={() => {
          qsPage.set("battery");
        }}
        child={
          <box spacing={2}>
            <image
              iconName={bind(battery, "batteryIconName")}
              iconSize={Gtk.IconSize.NORMAL}
            />
            <label
              label={bind(battery, "percentage").as(
                (p) => `${Math.floor(p * 100)}%`,
              )}
            />
          </box>
        }
      />
      <button
        onClicked={() => {
          App.toggle_window(WINDOW_NAME);
          timeout(200, () => {
            screenRecord.screenshot();
          });
        }}
        child={<image iconName={"gnome-screenshot-symbolic"} />}
      />
      <box hexpand />
      <button
        onClicked={() => {
          const wlCopy = (color: string) =>
            execAsync(["wl-copy", color]).catch(console.error);

          App.toggle_window(WINDOW_NAME);
          timeout(200, () => {
            execAsync("hyprpicker")
              .then((color) => {
                if (!color) return;

                wlCopy(color);
                notifySend({
                  appName: "Hyprpicker",
                  summary: "Color Picker",
                  body: `${color} copied to clipboard`,
                });
              })
              .catch((error) => {
                console.error("Hyprpicker error:", error);
              });
          });
        }}
        child={<image iconName={"color-select-symbolic"} />}
      />
      <button
        onClicked={() => {
          App.toggle_window(WINDOW_NAME);
          toggleWallpaperPicker();
        }}
        child={<image iconName={"preferences-desktop-wallpaper-symbolic"} />}
      />
      <button
        onClicked={() => {
          bash(`better-control`);
          App.toggle_window(WINDOW_NAME);
        }}
        child={
          <image
            iconName={"system-settings-symbolic"}
            iconSize={Gtk.IconSize.NORMAL}
          />
        }
      />
    </box>
  );
}

function ArrowButton<T extends GObject.Object>({
  icon,
  title,
  subtitle,
  onClicked,
  onArrowClicked,
  connection: [gobject, property],
}: {
  icon: string | Binding<string>;
  title: string;
  subtitle: string | Binding<string>;
  onClicked: () => void;
  onArrowClicked: () => void;
  connection: [T, keyof T];
}) {
  return (
    <box
      overflow={Gtk.Overflow.HIDDEN}
      cssClasses={bind(gobject, property).as((p) => {
        const classes = ["arrow-button"];
        p && classes.push("active");
        return classes;
      })}
    >
      <button
        onClicked={onClicked}
        child={
          <box halign={Gtk.Align.START} hexpand>
            <image iconName={icon} iconSize={Gtk.IconSize.LARGE} />
            <box vertical>
              <label
                xalign={0}
                label={title}
                cssClasses={["title"]}
                maxWidthChars={8}
              />
              <label
                xalign={0}
                label={subtitle}
                cssClasses={["subtitle"]}
                maxWidthChars={8}
              />
            </box>
          </box>
        }
      />
      <button
        iconName={"go-next-symbolic"}
        cssClasses={["next-page"]}
        onClicked={onArrowClicked}
      />
    </box>
  );
}

function WifiArrowButton() {
  const wifi = AstalNetwork.get_default()?.wifi;
  if (!wifi) return null;
  const wifiSsid = Variable.derive(
    [bind(wifi, "state"), bind(wifi, "ssid")],
    (state, ssid) => {
      return state == AstalNetwork.DeviceState.ACTIVATED
        ? ssid
        : AstalNetwork.device_state_to_string();
    },
  );

  return (
    <ArrowButton
      icon={bind(wifi, "iconName")}
      title="Wi-Fi"
      subtitle={wifiSsid()}
      onClicked={() => wifi.set_enabled(!wifi.get_enabled())}
      onArrowClicked={() => {
        wifi.scan();
        qsPage.set("wifi");
      }}
      connection={[wifi, "enabled"]}
    />
  );
}

function WifiBluetooth() {
  const bluetooth = AstalBluetooth.get_default();
  if (!bluetooth) return null;
  const btAdapter = bluetooth.adapter;
  const deviceConnected = Variable.derive(
    [bind(bluetooth, "devices"), bind(bluetooth, "isConnected")],
    (d, _) => {
      for (const device of d) {
        if (device.connected) return device.name;
      }
      return "No device";
    },
  );
  const wifi = AstalNetwork.get_default()?.wifi;

  return (
    <box
      homogeneous
      spacing={6}
      onDestroy={() => {
        deviceConnected.drop();
      }}
    >
      {!!wifi && <WifiArrowButton />}
      <ArrowButton
        icon={bind(btAdapter, "powered").as(
          (p) => `bluetooth-${p ? "" : "disabled-"}symbolic`,
        )}
        title="Bluetooth"
        subtitle={deviceConnected()}
        onClicked={() => bluetooth.toggle()}
        // onArrowClicked={() => console.log("Will add bt page later")}
        onArrowClicked={() => {
          qsPage.set("bluetooth");
        }}
        connection={[btAdapter, "powered"]}
      />
    </box>
  );
}

function ConnectivityButtons() {
  const bluetooth = AstalBluetooth.get_default();
  const wifi = AstalNetwork.get_default()?.wifi;

  if (!bluetooth) return null;
  const btAdapter = bluetooth.adapter;
  const deviceConnected = Variable.derive(
    [bind(bluetooth, "devices"), bind(bluetooth, "isConnected")],
    (d, _) => {
      for (const device of d) {
        if (device.connected) return device.name;
      }
      return "No device";
    },
  );

  return (
    <box
      homogeneous
      spacing={6}
      onDestroy={() => {
        deviceConnected.drop();
      }}
    >
      {!!wifi && <WifiArrowButton />}
      <ArrowButton
        icon={bind(btAdapter, "powered").as(
          (p) => `bluetooth-${p ? "" : "disabled-"}symbolic`,
        )}
        title="Bluetooth"
        subtitle={deviceConnected()}
        onClicked={() => bluetooth.toggle()}
        onArrowClicked={() => {
          qsPage.set("bluetooth");
        }}
        connection={[btAdapter, "powered"]}
      />
    </box>
  );
}

function MediaSourcesArrowButton() {
  const wp = AstalWp.get_default();
  if (!wp || !wp.audio) return null;

  const audio = wp.audio;
  const defaultSpeaker = wp.defaultSpeaker;

  const sourceCount = Variable.derive([bind(audio, "streams")], (streams) => {
    const audioStreams = streams.filter(
      (stream) =>
        stream.mediaClass === AstalWp.MediaClass.STREAM_OUTPUT_AUDIO ||
        stream.mediaClass === AstalWp.MediaClass.STREAM_INPUT_AUDIO,
    );
    return `${audioStreams.length} apps`;
  });

  return (
    <box
      overflow={Gtk.Overflow.HIDDEN}
      cssClasses={bind(defaultSpeaker, "mute").as((muted) => {
        const classes = ["arrow-button"];
        !muted && classes.push("active"); // Active when NOT muted
        return classes;
      })}
    >
      <button
        onClicked={() => {
          // Toggle mute on default speaker as main action
          if (defaultSpeaker) {
            defaultSpeaker.set_mute(!defaultSpeaker.mute);
          }
        }}
        child={
          <box halign={Gtk.Align.START} hexpand>
            <image
              iconName="applications-multimedia-symbolic"
              iconSize={Gtk.IconSize.LARGE}
            />
            <box vertical>
              <label
                xalign={0}
                label="Media"
                cssClasses={["title"]}
                maxWidthChars={8}
              />
              <label
                xalign={0}
                label={sourceCount()}
                cssClasses={["subtitle"]}
                maxWidthChars={8}
              />
            </box>
          </box>
        }
      />
      <button
        iconName={"go-next-symbolic"}
        cssClasses={["next-page"]}
        onClicked={() => {
          qsPage.set("media-sources");
        }}
      />
    </box>
  );
}

function MainPage() {
  return (
    <box cssClasses={["qs-page"]} name={"main"} vertical spacing={6}>
      <Header />
      <Gtk.Separator />
      <VolumeBox />
      <BrightnessBox />
      {/* <Gtk.Separator /> */}
      <ConnectivityButtons />
      <QSButtons />
      <QSButtons_child />
      <MediaPlayers />
      {/* <Cava /> */}
    </box>
  );
}

function QSWindow(_gdkmonitor: Gdk.Monitor) {
  return (
    <PopupWindow
      name={WINDOW_NAME}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      layout="top_right"
      margin={10}
      onDestroy={() => layout.drop()}
      child={
        <box
          cssClasses={["qs-container"]}
          hexpand={false}
          vexpand={false}
          vertical
          child={
            // @ts-ignore it has children
            <stack
              visibleChildName={qsPage()}
              transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT}
              transitionDuration={300}
            >
              <MainPage />
              <BatteryPage />
              <SpeakerPage />
              <MediaSourcesPage />
              <WifiPage />
              <BluetoothPage />
            </stack>
          }
        />
      }
    />
  );
}

export default function (gdkmonitor: Gdk.Monitor) {
  QSWindow(gdkmonitor);

  App.connect("window-toggled", (_, win) => {
    if (win.name == WINDOW_NAME && !win.visible) {
      qsPage.set("main");
    }
  });

  layout.subscribe(() => {
    App.remove_window(App.get_window(WINDOW_NAME)!);
    QSWindow(gdkmonitor);
  });
}
