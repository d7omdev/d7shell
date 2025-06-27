import { timeout } from "astal";
import { App, Astal, Gdk, hook, Gtk } from "astal/gtk4";
import AstalNotifd from "gi://AstalNotifd";
import Notification from "./Notification";

export default function NotificationPopup(gdkmonitor: Gdk.Monitor) {
  const { TOP, RIGHT } = Astal.WindowAnchor;
  const notifd = AstalNotifd.get_default();

  function setupPopup(self: Gtk.Window) {
    const notificationQueue: number[] = [];
    let isProcessing = false;
    self.default_height = -1;

    function enqueueNotification(id: number) {
      notificationQueue.push(id);
      processQueue();
    }

    function dequeueNotification() {
      self.visible = false;
      self.default_height = 0;
      isProcessing = false;
      self.set_child(null);
      timeout(300, processQueue);
    }

    function processQueue() {
      if (isProcessing || notificationQueue.length === 0) return;
      isProcessing = true;
      const id = notificationQueue.shift();
      const notification = notifd.get_notification(id!);
      if (!notification) {
        isProcessing = false;
        timeout(300, processQueue);
        return;
      }
      self.set_child(
        <box vertical vexpand hexpand>
          <Notification n={notification} />
          <box vexpand />
        </box>,
      );
      self.visible = true;
      self.default_height = -1;

      timeout(5000, () => {
        notification.dismiss();
        dequeueNotification();
      });
    }

    hook(self, notifd, "notified", (_, id: number) => {
      const notification = notifd.get_notification(id);
      if (
        !notification ||
        (notifd.dont_disturb &&
          notification.urgency != AstalNotifd.Urgency.CRITICAL)
      ) {
        return;
      }
      enqueueNotification(id);
    });

    hook(self, notifd, "resolved", () => {
      dequeueNotification();
    });
  }

  return (
    <window
      namespace={"notifications-popup"}
      margin={10}
      width_request={300}
      setup={setupPopup}
      gdkmonitor={gdkmonitor}
      application={App}
      anchor={TOP | RIGHT}
    />
  );
}
