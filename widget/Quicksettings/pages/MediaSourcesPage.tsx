import { bind } from "astal";
import { Gtk } from "astal/gtk4";
import AstalWp from "gi://AstalWp?version=0.1";
import Pango from "gi://Pango?version=1.0";
import { qsPage } from "../QSWindow";

const wp = AstalWp.get_default();

function AppAudioControl({ stream }: { stream: AstalWp.Stream }) {
  return (
    <box cssClasses={["app-audio-control"]} vertical spacing={6}>
      <box spacing={8}>
        <image
          iconName={stream.icon || "application-x-executable"}
          iconSize={Gtk.IconSize.LARGE}
        />
        <box vertical hexpand>
          <label
            label={stream.description + " - " + stream.name}
            xalign={0}
            cssClasses={["title"]}
            ellipsize={Pango.EllipsizeMode.END}
            maxWidthChars={25}
          />
          <label
            label={bind(stream, "volume").as(
              (vol) => `Volume: ${Math.round(vol * 100)}%`,
            )}
            xalign={0}
            cssClasses={["subtitle"]}
            ellipsize={Pango.EllipsizeMode.END}
            maxWidthChars={25}
          />
        </box>
        <button
          cssClasses={bind(stream, "mute").as((muted) => {
            const classes = ["mute-button"];
            if (muted) classes.push("active");
            return classes;
          })}
          iconName={bind(stream, "volumeIcon")}
          onClicked={() => stream.set_mute(!stream.mute)}
        />
      </box>
      <box spacing={8}>
        <image iconName="audio-volume-low-symbolic" />
        <slider
          cssClasses={["volume-slider"]}
          hexpand
          min={0}
          max={1.5}
          value={bind(stream, "volume")}
          onChangeValue={({ value }) => {
            stream.set_volume(value);
          }}
          marginStart={8}
          marginEnd={8}
        />
        <image iconName="audio-volume-high-symbolic" />
      </box>
    </box>
  );
}

export default function MediaSourcesPage() {
  const audio = wp?.audio;

  if (!audio) {
    return (
      <box cssClasses={["qs-page"]} name="media-sources" vertical spacing={6}>
        <box cssClasses={["header"]} spacing={6}>
          <button
            iconName="go-previous-symbolic"
            onClicked={() => qsPage.set("main")}
          />
          <label label="App Audio Control" cssClasses={["title"]} hexpand />
        </box>
        <Gtk.Separator />
        <label label="No audio system available" />
      </box>
    );
  }

  return (
    <box cssClasses={["qs-page"]} name="media-sources" vertical spacing={6}>
      <box cssClasses={["header"]} spacing={6}>
        <button
          iconName="go-previous-symbolic"
          onClicked={() => qsPage.set("main")}
        />
        <label label="App Audio Control" cssClasses={["title"]} hexpand />
      </box>
      <Gtk.Separator />
      <box vertical spacing={6}>
        {bind(audio, "streams").as((streams) => {
          const audioStreams = streams.filter(
            (stream) =>
              stream.mediaClass === AstalWp.MediaClass.STREAM_OUTPUT_AUDIO ||
              stream.mediaClass === AstalWp.MediaClass.STREAM_INPUT_AUDIO,
          );

          if (audioStreams.length === 0) {
            return [
              <box cssClasses={["no-streams"]} vertical spacing={12}>
                <image
                  iconName="audio-x-generic"
                  iconSize={Gtk.IconSize.LARGE}
                />
                <label
                  label="No audio applications running"
                  cssClasses={["subtitle"]}
                />
              </box>,
            ];
          }

          return audioStreams.map((stream) => (
            <AppAudioControl stream={stream} />
          ));
        })}
      </box>
    </box>
  );
}
