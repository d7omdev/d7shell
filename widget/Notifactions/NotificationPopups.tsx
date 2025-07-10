import { Astal, Gtk } from "astal/gtk4";
import { App } from "astal/gtk4";
import Notifd from "gi://AstalNotifd";
import Notification from "./Notification";
import { type Subscribable } from "astal/binding";
import { Variable, bind, timeout } from "astal";
import Hyprland from "gi://AstalHyprland";

const TIMEOUT_DELAY = 5_000;

function hasDestroy(widget: unknown): widget is { destroy: () => void } {
  return (
    typeof widget === "object" &&
    widget !== null &&
    typeof (widget as { destroy?: () => void }).destroy === "function" &&
    typeof (widget as { is_visible?: unknown }).is_visible !== "undefined"
  );
}

class NotificationMap implements Subscribable {
  private map: Map<number, Gtk.Widget> = new Map();
  private destroying: Set<number> = new Set();

  private var: Variable<Array<Gtk.Widget>> = Variable([]);

  private notify() {
    this.var.set([...this.map.values()].reverse());
  }

  constructor() {
    const notifd = Notifd.get_default();

    notifd.connect("notified", (_, id) => {
      const notification = notifd.get_notification(id);
      console.log("Received notification:", {
        id: notification.id,
        appName: notification.appName,
        summary: notification.summary,
        body: notification.body,
        urgency: notification.urgency,
        time: notification.time,
        appIcon: notification.appIcon,
        image: notification.image,
        desktopEntry: notification.desktopEntry,
        actions: notification.get_actions
          ? notification.get_actions().map((a) => {
              return {
                name: a.id,
                label: a.label,
              };
            })
          : undefined,
      });

      let timeoutHandle: ReturnType<typeof timeout> | null = null;
      let isHovered = false;

      const startTimeout = () => {
        if (timeoutHandle) {
          timeoutHandle.cancel();
        }
        timeoutHandle = timeout(TIMEOUT_DELAY, () => {
          if (!isHovered) {
            this.delete(id);
          }
        });
      };

      this.set(
        id,
        Notification({
          n: notification!,
          setup: () => startTimeout(),
          onHover: () => {
            isHovered = true;
            if (timeoutHandle) {
              timeoutHandle.cancel();
              timeoutHandle = null;
            }
          },
          onHoverLost: () => {
            isHovered = false;
            // Start timeout with delay after hover lost
            timeoutHandle = timeout(1000, () => {
              if (!isHovered) {
                this.delete(id);
              }
            });
          },
        }),
      );
    });

    notifd.connect("resolved", (_, id) => {
      this.delete(id);
    });
  }

  private set(key: number, value: Gtk.Widget) {
    const prev = this.map.get(key);
    if (prev) {
      this.map.delete(key);

      if (hasDestroy(prev) && prev.is_visible !== undefined) {
        try {
          prev.destroy();
        } catch (error) {
          console.log("Widget already destroyed:", error);
        }
      }
    }

    this.map.set(key, value);
    this.notify();
  }

  private delete(key: number) {
    if (this.destroying.has(key)) return;

    const prev = this.map.get(key);
    if (!prev) return;

    this.destroying.add(key);
    this.map.delete(key);

    if (hasDestroy(prev) && prev.is_visible !== undefined) {
      try {
        prev.destroy();
      } catch (error) {
        console.log("Widget already destroyed:", error);
      }
    }

    this.destroying.delete(key);
    this.notify();
  }

  get() {
    return this.var.get();
  }

  subscribe(callback: (list: Array<Gtk.Widget>) => void) {
    return this.var.subscribe(callback);
  }
}

export default function NotificationPopups(
  monitor: Hyprland.Monitor,
): Astal.Window {
  const notifs = new NotificationMap();
  const { TOP, RIGHT } = Astal.WindowAnchor;

  return (
    <window
      namespace={"notifications-popup"}
      application={App}
      visible={bind(notifs).as((values) => {
        return values.length !== 0;
      })}
      margin={10}
      margin_right={0}
      monitor={monitor.id}
      anchor={TOP | RIGHT}
      child={
        <box spacing={6} vertical={true}>
          {bind(notifs)}
        </box>
      }
    />
  ) as Astal.Window;
}
