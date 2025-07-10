import { Gtk } from "astal/gtk4";
import { GLib } from "astal";
import Adw from "gi://Adw?version=1";
import Pango from "gi://Pango";
import AstalNotifd from "gi://AstalNotifd";

const time = (time: number, format = "%H:%M") =>
  GLib.DateTime.new_from_unix_local(time).format(format);

const isIcon = (icon: string | null | undefined) => {
  if (!icon) return false;
  const iconTheme = new Gtk.IconTheme();
  return iconTheme.has_icon(icon);
};

const fileExists = (path: string) => GLib.file_test(path, GLib.FileTest.EXISTS);

const urgency = (n: AstalNotifd.Notification) => {
  const { LOW, NORMAL, CRITICAL } = AstalNotifd.Urgency;

  switch (n.urgency) {
    case LOW:
      return "low";
    case CRITICAL:
      return "critical";
    case NORMAL:
    default:
      return "normal";
  }
};

const HIDE_TIMEOUT_MS = 500;

export default function Notification({
  n,
  showActions = true,
  setup,
  onHover,
  onHoverLost,
}: {
  n: AstalNotifd.Notification;
  showActions?: boolean;
  setup?: (self: Gtk.Box) => void;
  onHoverLost?: (self: Gtk.Box) => void;
  onHover?: (self: Gtk.Box) => void;
}) {
  return (
    <Adw.Clamp
      maximumSize={420}
      child={(() => {
        const children: Gtk.Widget[] = [];

        // Header
        children.push(
          <box
            cssClasses={["header"]}
            orientation={Gtk.Orientation.HORIZONTAL}
            valign={Gtk.Align.CENTER}
          >
            {(() => {
              const isHyprshot = n.appName === "Hyprshot";
              const appIconName = isHyprshot
                ? "applets-screenshooter-symbolic"
                : n.appIcon ||
                  (isIcon(n.desktopEntry) ? n.desktopEntry : undefined);
              const iconWidget = appIconName ? (
                <image
                  cssClasses={["app-icon"]}
                  iconName={appIconName}
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.START}
                />
              ) : undefined;
              return [
                ...(iconWidget ? [iconWidget] : []),
                <label
                  cssClasses={["app-name"]}
                  halign={Gtk.Align.START}
                  ellipsize={Pango.EllipsizeMode.END}
                  label={n.appName || "Unknown"}
                />,
                <label
                  cssClasses={["time"]}
                  hexpand
                  halign={Gtk.Align.END}
                  label={time(n.time, "%I:%M %p")!}
                />,
                <button
                  onClicked={() => n.dismiss()}
                  iconName="window-close-symbolic"
                />,
              ];
            })()}
          </box>,
        );

        children.push(
          <Gtk.Separator visible orientation={Gtk.Orientation.HORIZONTAL} />,
        );

        children.push(
          <box
            orientation={Gtk.Orientation.HORIZONTAL}
            spacing={12}
            cssClasses={["content"]}
            valign={Gtk.Align.CENTER}
          >
            {(() => {
              const isHyprshot = n.appName === "Hyprshot";
              const mainImage = isHyprshot ? n.appIcon : n.image;
              const imageWidget =
                mainImage && fileExists(mainImage) ? (
                  <image
                    cssClasses={["image-file"]}
                    file={mainImage}
                    widthRequest={64}
                    heightRequest={64}
                    valign={Gtk.Align.CENTER}
                  />
                ) : undefined;
              const contentChildren: Gtk.Widget[] = [];
              if (imageWidget) contentChildren.push(imageWidget);
              const textChildren: Gtk.Widget[] = [
                <label
                  cssClasses={["summary"]}
                  halign={Gtk.Align.START}
                  xalign={0}
                  label={n.summary}
                  ellipsize={Pango.EllipsizeMode.END}
                />,
              ];
              if (n.body) {
                const bodyText =
                  n.body.length > 200
                    ? n.body.substring(0, 200) + "..."
                    : n.body;
                textChildren.push(
                  <label
                    cssClasses={["body"]}
                    wrap
                    useMarkup
                    halign={Gtk.Align.START}
                    xalign={0}
                    justify={Gtk.Justification.FILL}
                    label={bodyText}
                  />,
                );
              }
              contentChildren.push(
                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                  {textChildren}
                </box>,
              );
              return contentChildren;
            })()}
          </box>,
        );

        const isHyprshot = n.appName === "Hyprshot";
        const hasRegularActions =
          showActions && n.get_actions && n.get_actions().length > 0;
        const hasHyprshotActions =
          isHyprshot && n.appIcon && fileExists(n.appIcon);

        if (hasRegularActions || hasHyprshotActions) {
          const actionButtons: JSX.Element[] = [];

          if (hasHyprshotActions) {
            actionButtons.push(
              <button
                hexpand={false}
                onClicked={() => {
                  GLib.spawn_command_line_async(`xdg-open "${n.appIcon}"`);
                }}
                label="Open Image"
                halign={Gtk.Align.CENTER}
                cssClasses={["action-button"]}
              />,
            );

            actionButtons.push(
              <button
                hexpand={false}
                onClicked={() => {
                  GLib.spawn_command_line_async(`gradia "${n.appIcon}"`);
                }}
                label="Edit Image"
                halign={Gtk.Align.CENTER}
                cssClasses={["action-button"]}
              />,
            );
          }

          if (hasRegularActions) {
            actionButtons.push(
              ...n
                .get_actions()
                .map(({ label, id }) => (
                  <button
                    hexpand={false}
                    onClicked={() => n.invoke(id)}
                    label={label}
                    halign={Gtk.Align.CENTER}
                    cssClasses={["action-button"]}
                  />
                )),
            );
          }

          children.push(
            <revealer
              cssClasses={["actions-revealer"]}
              transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
              transitionDuration={200}
              revealChild={false}
              child={
                <box
                  cssClasses={["actions"]}
                  spacing={8}
                  halign={Gtk.Align.CENTER}
                  valign={Gtk.Align.CENTER}
                  hexpand
                >
                  {actionButtons}
                </box>
              }
            />,
          );
        }

        return (
          <box
            cssClasses={["notification-container", urgency(n)]}
            orientation={Gtk.Orientation.VERTICAL}
            setup={(self) => {
              if (hasRegularActions || hasHyprshotActions) {
                const revealer = self.get_last_child() as Gtk.Revealer;
                if (revealer && revealer instanceof Gtk.Revealer) {
                  (
                    self as Gtk.Box & {
                      _actionsRevealer?: Gtk.Revealer;
                    }
                  )._actionsRevealer = revealer;
                }
              }
              if (setup) {
                setup(self);
              }
            }}
            onHoverEnter={(self) => {
              const revealer = (
                self as Gtk.Box & { _actionsRevealer?: Gtk.Revealer }
              )._actionsRevealer;
              if (revealer && revealer instanceof Gtk.Revealer) {
                revealer.set_reveal_child(true);
              }

              if (onHover) {
                onHover(self);
              }
            }}
            onHoverLeave={(self) => {
              const revealer = (
                self as Gtk.Box & { _actionsRevealer?: Gtk.Revealer }
              )._actionsRevealer;
              if (revealer && revealer instanceof Gtk.Revealer) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, HIDE_TIMEOUT_MS, () => {
                  revealer.set_reveal_child(false);
                  return GLib.SOURCE_REMOVE;
                });
              }
              if (onHoverLost) {
                onHoverLost(self);
              }
            }}
          >
            {children}
          </box>
        );
      })()}
    />
  );
}
