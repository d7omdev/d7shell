import Wp from "gi://AstalWp";
import Window from "../../common/PopupWindow";
import Brightness from "../../lib/brightness";
import { iconConfig } from "../../lib/utils";
import { bind, timeout } from "astal";
import { Astal, Gtk, hook } from "astal/gtk4";
import type { Binding } from "astal";

const WINDOW_NAME = "osd";
const TIMEOUT = 2000;
// BUG: artifacts remain on hide https://github.com/wmww/gtk4-layer-shell/issues/60
const TRANSITION = Gtk.RevealerTransitionType.SLIDE_LEFT;

function OsdSlider({
  value,
  iconName,
  onShow,
  onHide,
  clampLowValue = false,
}: {
  value: Binding<number>;
  iconName: string | Binding<string>;
  onShow: () => void;
  onHide: () => void;
  clampLowValue?: boolean;
}) {
  const barHeight = 256;
  const iconHeight = 28;
  const minMargin = 8;
  const minValue = 0.08;
  const clampValue = 0.15;

  return (
    <revealer
      transitionType={TRANSITION}
      setup={(self) => {
        let i = 0;
        hook(self, value, () => {
          onShow();
          self.set_reveal_child(true);
          self.set_opacity(1);
          i++;
          timeout(TIMEOUT, () => {
            i--;
            if (i === 0) {
              self.set_reveal_child(false);
              onHide();
              self.set_opacity(0.1);
            }
          });
        });
      }}
      child={
        <box
          cssClasses={["osd-box"]}
          children={[
            <overlay>
              <levelbar
                cssClasses={["osd-bar"]}
                value={value.as((v: number) => Math.max(0, Math.min(v, 1)))}
                orientation={Gtk.Orientation.VERTICAL}
                inverted
              />
              <image
                type="overlay"
                iconName={iconName}
                cssClasses={["osd-icon"]}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.START}
                margin_top={value.as((v: number) => {
                  const usedValue = clampLowValue
                    ? Math.max(v, clampValue)
                    : Math.max(v, minValue);
                  return Math.round(
                    minMargin +
                      (1 - usedValue) *
                        (barHeight - iconHeight - 2 * minMargin),
                  );
                })}
              />
            </overlay>,
          ]}
        />
      }
    />
  );
}

function BrightnessSlider(onShow: () => void, onHide: () => void) {
  const brightness = Brightness.get_default();
  if (!brightness) return null;
  return (
    <OsdSlider
      value={bind(brightness, "screen")}
      iconName={iconConfig.brightness.screen}
      onShow={onShow}
      onHide={onHide}
      clampLowValue={true}
    />
  );
}

function VolumeSlider(onShow: () => void, onHide: () => void) {
  const wp = Wp.get_default();
  const audio =
    wp && wp.audio && wp.audio.defaultSpeaker ? wp.audio.defaultSpeaker : null;
  if (!audio) return null;
  return (
    <OsdSlider
      value={bind(audio, "volume")}
      iconName={bind(audio, "volume").as((v) => {
        if (v === 0) return iconConfig.audio.volume.muted;
        if (v < 0.33) return iconConfig.audio.volume.low;
        if (v < 0.66) return iconConfig.audio.volume.medium;
        return iconConfig.audio.volume.high;
      })}
      onShow={onShow}
      onHide={onHide}
      clampLowValue={true}
    />
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

  const widgets = [
    BrightnessSlider(onShow, onHide),
    VolumeSlider(onShow, onHide),
  ].filter((w): w is Gtk.Widget => w !== null);
  return (
    <Window
      name={WINDOW_NAME}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={Astal.WindowAnchor.RIGHT}
      keymode={Astal.Keymode.NONE}
      visible={false}
      defaultWidth={-1}
      margin={0}
      setup={(self) => {
        windowRef = self;
      }}
      child={<box cssClasses={["osd-window"]}>{widgets}</box>}
    />
  );
}
