import AstalWp from "gi://AstalWp?version=0.1";
import { qsPage } from "../QSWindow";
import { Gtk } from "astal/gtk4";
import { bind } from "astal";
import Pango from "gi://Pango";

export default function SpeakerPage() {
  const audio = AstalWp.get_default()!.audio;
  return (
    <box
      name={"speaker"}
      cssClasses={["speaker-page", "qs-page"]}
      vertical
      spacing={6}
    >
      <box hexpand={false} cssClasses={["header"]} spacing={6}>
        <button
          onClicked={() => {
            qsPage.set("main");
          }}
          iconName={"go-previous-symbolic"}
        />
        <label
          useMarkup={true}
          label={"<b> Audio Devices</b>"}
          hexpand
          xalign={0}
        />
      </box>

      <Gtk.Separator />

      <label useMarkup={true} label={"<b>Output Devices</b>"} xalign={0} />
      {bind(audio, "speakers").as((speakers) =>
        speakers.map((speaker) => (
          <button
            cssClasses={bind(speaker, "isDefault").as((isD) => {
              const classes = ["button"];
              isD && classes.push("active");
              return classes;
            })}
            onClicked={() => {
              speaker.set_is_default(true);
            }}
          >
            <box>
              <image iconName={speaker.volumeIcon} />
              <label
                label={speaker.description}
                ellipsize={Pango.EllipsizeMode.END}
                maxWidthChars={30}
              />
            </box>
          </button>
        )),
      )}

      <Gtk.Separator />

      <label useMarkup={true} label={"<b>Input Devices</b>"} xalign={0} />
      {bind(audio, "microphones").as((microphones) =>
        microphones.map((microphone) => (
          <button
            cssClasses={bind(microphone, "isDefault").as((isD) => {
              const classes = ["button"];
              isD && classes.push("active");
              return classes;
            })}
            onClicked={() => {
              microphone.set_is_default(true);
            }}
          >
            <box>
              <image
                iconName={
                  microphone.volumeIcon ||
                  "microphone-sensitivity-high-symbolic"
                }
              />
              <label
                label={microphone.description}
                ellipsize={Pango.EllipsizeMode.END}
                maxWidthChars={30}
              />
            </box>
          </button>
        )),
      )}
    </box>
  );
}
