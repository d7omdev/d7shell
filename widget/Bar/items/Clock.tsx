import { bind, Variable } from "astal";
import { App, Gtk } from "astal/gtk4";
import AstalMpris from "gi://AstalMpris?version=0.1";
import AstalNotifd from "gi://AstalNotifd";
import Pango from "gi://Pango?version=1.0";
import { time } from "../../../lib/utils";
import options from "../../../option";
import { WINDOW_NAME } from "../../Dashbord/Dashboard";
import PanelButton from "../PanelButton";
import GLib from "gi://GLib";

const notifd = AstalNotifd.get_default();
const mpris = AstalMpris.get_default();
const { bar } = options;
const datetime = bar.datetime;

export const isPlaying = Variable(false);
export const currentTrack = Variable("");
const revealTrack = Variable(false);

let trackRevealTimer: number | null = null;

const getCurrentTrack = () => {
  try {
    const players = mpris.get_players();
    const playingPlayer = players.find(
      (player) => player.playbackStatus === AstalMpris.PlaybackStatus.PLAYING,
    );

    if (playingPlayer) {
      const title = playingPlayer.title || "Unknown Music";
      const previousTrack = currentTrack.get();
      currentTrack.set(title);

      if (title !== previousTrack && title !== "") {
        if (trackRevealTimer !== null) {
          GLib.source_remove(trackRevealTimer);
        }
        revealTrack.set(true);
        trackRevealTimer = GLib.timeout_add_seconds(
          GLib.PRIORITY_DEFAULT,
          2,
          () => {
            revealTrack.set(false);
            trackRevealTimer = null;
            return GLib.SOURCE_REMOVE;
          },
        );
      }
    } else {
      currentTrack.set("");
    }
  } catch (error) {
    console.error("Error getting current track:", error);
    currentTrack.set("");
  }
};

const checkPlayingStatus = () => {
  try {
    const players = mpris.get_players();
    const playing = players.some(
      (player) => player.playbackStatus === AstalMpris.PlaybackStatus.PLAYING,
    );
    time;
    isPlaying.set(playing);
    getCurrentTrack();
  } catch (error) {
    console.error("Error checking playing status:", error);
    isPlaying.set(false);
    currentTrack.set("");
  }
};

const handlePlayers = () => {
  mpris.get_players().forEach((player) => {
    player.connect("notify::playback-status", checkPlayingStatus);
    player.connect("notify::metadata", getCurrentTrack);
  });
  checkPlayingStatus();
};

mpris.connect("player-added", (_, player) => {
  player.connect("notify::playback-status", checkPlayingStatus);
  player.connect("notify::metadata", getCurrentTrack);
  checkPlayingStatus();
});

mpris.connect("player-closed", () => {
  checkPlayingStatus();
});

handlePlayers();

export default function TimePanelButton() {
  const isnotif = Variable(false);

  return (
    <PanelButton
      window={WINDOW_NAME}
      cssClasses={["panel-button", "dashboard-button", "px-2"]}
      onClicked={() => App.toggle_window(WINDOW_NAME)}
      child={
        <box spacing={6}>
          <box
            onHoverEnter={() => isnotif.set(true)}
            onHoverLeave={() => isnotif.set(false)}
            margin_start={2}
            margin_end={2}
          >
            <revealer
              transitionDuration={300}
              transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
              revealChild={bind(isnotif)}
              child={
                <label
                  cssClasses={["label"]}
                  marginEnd={4}
                  label={bind(notifd, "notifications").as(
                    (notifications) =>
                      `You have ${notifications.length} ${notifications.length === 1 ? "message" : "messages"}`,
                  )}
                />
              }
            />
            <image
              cssClasses={["circle"]}
              iconName={"message-notif-symbolic"}
            />
            <revealer
              transitionDuration={300}
              transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
              reveal_child={bind(isnotif).as((is) => !is)}
              halign={Gtk.Align.CENTER}
              valign={Gtk.Align.CENTER}
              margin_start={2}
              child={
                <label
                  cssClasses={["label"]}
                  marginStart={2}
                  halign={Gtk.Align.CENTER}
                  valign={Gtk.Align.CENTER}
                  label={bind(notifd, "notifications").as((notifications) =>
                    notifications.length > 0
                      ? notifications.length.toString()
                      : "",
                  )}
                />
              }
            />
          </box>

          <label
            label={time((t) => t.format(datetime.dateFormat.get())).as(
              (date) => date || "",
            )}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
          />
          <label label="•" />
          <label
            cssClasses={["time"]}
            label={time((t) => t.format(datetime.timeFormat.get())).as(
              (time) => time || "",
            )}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
          />

          <box
            visible={bind(isPlaying)}
            onHoverEnter={() => revealTrack.set(true)}
            onHoverLeave={() => revealTrack.set(false)}
          >
            <image iconName={"music-playing-symbolic"} />
            <revealer
              transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
              transitionDuration={300}
              revealChild={bind(revealTrack)}
              child={
                <label
                  label={bind(currentTrack).as((track) => track || "")}
                  maxWidthChars={20}
                  marginStart={4}
                  ellipsize={Pango.EllipsizeMode.END}
                />
              }
            />
          </box>
        </box>
      }
    />
  );
}
