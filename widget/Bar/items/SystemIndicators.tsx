import { App } from "astal/gtk4";
import PanelButton from "../PanelButton";
import { WINDOW_NAME } from "../../Quicksettings/QSWindow";
import AstalBattery from "gi://AstalBattery";
import AstalWp from "gi://AstalWp";
import { bind } from "astal";
import AstalPowerProfiles from "gi://AstalPowerProfiles";
import AstalNetwork from "gi://AstalNetwork";
import AstalBluetooth from "gi://AstalBluetooth";
import KeyboardLayout from "./KeyboardLayout";

function NetworkIcon() {
  const network = AstalNetwork.get_default();

  // Check if network is available
  if (!network) return <box />;

  // If no WiFi but has wired connection
  if (!network.wifi && network.wired) {
    return <image iconName={bind(network.wired, "iconName")} />;
  }

  // If no WiFi and no wired connection
  if (!network.wifi && !network.wired) {
    return <image iconName="network-offline" />;
  }

  // Default to WiFi icon
  return <image iconName={bind(network.wifi, "iconName")} />;
}

function SpeakerIcon() {
  const wp = AstalWp.get_default();
  const speaker = wp?.audio?.defaultSpeaker;

  if (!speaker) return <box />;

  return <image iconName={bind(speaker, "volumeIcon")} />;
}

export default function QSPanelButton() {
  const battery = AstalBattery.get_default();
  const bluetooth = AstalBluetooth.get_default();
  const wp = AstalWp.get_default();
  const powerprofile = AstalPowerProfiles.get_default();

  return (
    <PanelButton
      window={WINDOW_NAME}
      onClicked={() => App.toggle_window(WINDOW_NAME)}
      child={
        <box spacing={6}>
          <KeyboardLayout />
          <NetworkIcon />
          <image
            visible={bind(bluetooth, "isPowered")}
            iconName={"bluetooth-symbolic"}
          />
          <image
            visible={bind(battery, "isPresent")}
            iconName={bind(battery, "batteryIconName")}
          />
          <SpeakerIcon />
          <image
            visible={bind(powerprofile, "activeProfile").as(
              (p) => p === "power-saver",
            )}
            iconName={"power-profile-power-saver-symbolic"}
          />
          <image
            visible={bind(powerprofile, "activeProfile").as(
              (p) => p === "performance",
            )}
            iconName={"power-profile-performance-symbolic"}
          />
          <image
            visible={
              wp?.defaultMicrophone && bind(wp.default_microphone, "mute")
            }
            iconName="microphone-disabled-symbolic"
          />
        </box>
      }
    />
  );
}
