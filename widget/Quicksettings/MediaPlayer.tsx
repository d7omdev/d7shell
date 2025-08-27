import Adw from "gi://Adw?version=1";
import { bind } from "astal";
import { Gtk } from "astal/gtk4";
import AstalMpris from "gi://AstalMpris";
import Pango from "gi://Pango";
import MaterialIcon from "../../common/MaterialIcon";

function MediaPlayer({ player }: { player: AstalMpris.Player }) {
  if (!player) {
    return <box />;
  }

  const title = bind(player, "title").as((t) => t || "Unknown Track");
  const artist = bind(player, "artist").as((a) => a || "Unknown Artist");
  const coverArt = bind(player, "coverArt");
  const playIcon = bind(player, "playbackStatus").as((s) =>
    s === AstalMpris.PlaybackStatus.PLAYING ? "pause" : "play_arrow",
  );

  function format_timecode(timecode: number) {
    timecode = Math.round(timecode);
    const seconds = timecode % 60;
    timecode = (timecode - seconds) / 60;
    const minutes = timecode % 60;
    timecode = (timecode - minutes) / 60;
    const hours = timecode;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }

  return (
    <box
      cssClasses={["media-player"]}
      hexpand
      child={
        <box hexpand spacing={12}>
          <image
            overflow={Gtk.Overflow.HIDDEN}
            cssClasses={["cover"]}
            file={coverArt}
            valign={Gtk.Align.CENTER}
          />

          <box vertical hexpand>
            <box vertical cssClasses={["media-font"]}>
              <box>
                <label
                  ellipsize={Pango.EllipsizeMode.END}
                  halign={Gtk.Align.START}
                  cssClasses={["tilte"]}
                  label={title}
                  maxWidthChars={20}
                />
                <box hexpand />
                <image
                  halign={Gtk.Align.END}
                  valign={Gtk.Align.START}
                  iconName="emblem-music-symbolic"
                  pixelSize={15}
                  // margin_end={10}
                  margin_top={4}
                />
              </box>
              <label
                halign={Gtk.Align.START}
                ellipsize={Pango.EllipsizeMode.END}
                maxWidthChars={20}
                cssClasses={["artist"]}
                label={artist}
              />
            </box>

            <box
              cssClasses={["progress_container"]}
              child={bind(player, "length").as((length) => (
                <slider
                  cssClasses={["progress"]}
                  // heightRequest={10}
                  // maxValue={length}
                  onChangeValue={({ value }) => {
                    try {
                      player.set_position(value * length);
                    } catch (error) {
                      console.warn("Failed to set posistion", error);
                    }
                  }}
                  value={bind(player, "position").as((p) =>
                    player.length > 0 ? p / player.length : p * 0.01,
                  )}
                  hexpand={true}
                />
              ))}
            />

            <box margin_top={2} hexpand>
              <box
                child={bind(player, "position").as((position) => (
                  <label
                    cssClasses={["labelSmaller"]}
                    valign={Gtk.Align.CENTER}
                    halign={Gtk.Align.START}
                    label={format_timecode(position)}
                  />
                ))}
              />

              <box hexpand halign={Gtk.Align.CENTER} spacing={4}>
                <button
                  valign={Gtk.Align.CENTER}
                  onClicked={() => player.loop()}
                  child={bind(player, "loopStatus").as((status) => (
                    <MaterialIcon
                      iconName={
                        status === AstalMpris.Loop.PLAYLIST
                          ? "repeat_on"
                          : status === AstalMpris.Loop.TRACK
                            ? "repeat_one_on"
                            : "repeat"
                      }
                      size="norm"
                    />
                  ))}
                />
                <button
                  valign={Gtk.Align.CENTER}
                  onClicked={() => player.previous()}
                  visible={bind(player, "canGoPrevious")}
                  cssClasses={["next-icon"]}
                  child={
                    <MaterialIcon
                      iconName="keyboard_double_arrow_left"
                      size="norm"
                    />
                  }
                />
                <button
                  valign={Gtk.Align.CENTER}
                  cssClasses={["play-icon"]}
                  onClicked={() => player.play_pause()}
                  visible={bind(player, "canControl")}
                  /*@ts-ignore Type error suff but it works */
                  child={<MaterialIcon iconName={playIcon} size="norm" />}
                />
                <button
                  valign={Gtk.Align.CENTER}
                  onClicked={() => player.next()}
                  visible={bind(player, "canGoNext")}
                  cssClasses={["next-icon"]}
                  child={
                    <MaterialIcon
                      iconName="keyboard_double_arrow_right"
                      size="norm"
                    />
                  }
                />
                <button
                  valign={Gtk.Align.CENTER}
                  onClicked={() => player.shuffle()}
                  child={bind(player, "shuffleStatus").as((status) => (
                    <MaterialIcon
                      iconName={
                        status === AstalMpris.Shuffle.ON
                          ? "shuffle_on"
                          : "shuffle"
                      }
                      size="norm"
                    />
                  ))}
                />
              </box>

              <box
                child={bind(player, "length").as((length) => (
                  <label
                    valign={Gtk.Align.CENTER}
                    halign={Gtk.Align.END}
                    cssClasses={["labelSmaller"]}
                    label={format_timecode(length)}
                  />
                ))}
              />
            </box>
          </box>
        </box>
      }
    />
  );
}

const isRealPLayer = (player: AstalMpris.Player) => {
  return !player.bus_name.includes("kdeconnect");
};

export default function MediaPlayers() {
  const mpris = AstalMpris.get_default();
  const carousel = new Adw.Carousel({ spacing: 8 });
  const playerWidgets = new Map();

  const players = mpris.get_players();

  if (players.length === 0) {
    return <box />;
  }

  for (const player of players) {
    if (isRealPLayer(player)) {
      const widget = MediaPlayer({ player });
      carousel.append(widget);
      playerWidgets.set(player, widget);
    }
  }

  mpris.connect("player-added", (_, player) => {
    console.log("player-added", player.busName);
    players.push(player);
    if (isRealPLayer(player)) {
      const widget = MediaPlayer({ player });
      carousel.append(widget);
      playerWidgets.set(player, widget);
    }
  });

  mpris.connect("player-closed", (_, player) => {
    console.log("player-removed", player.busName);
    const widget = playerWidgets.get(player);
    if (!widget) {
      console.error("couldn't find widget for player", player.busName);
      return;
    }

    carousel.remove(widget);

    const idx = players.indexOf(player);
    if (idx >= 0) {
      players.splice(idx, 1);
    } else {
      console.error("couldn't find player in players array", player.busName);
    }

    playerWidgets.delete(player);
  });
  carousel.add_css_class("mediaPlayersContainer");

  return (
    <box hexpand={false} vertical>
      {carousel}
      {new Adw.CarouselIndicatorLines({ carousel })}
    </box>
  );
}
