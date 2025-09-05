import { bind } from "astal";
import { Gtk } from "astal/gtk4";
import AstalTray from "gi://AstalTray?version=0.1";

export default function TrayPanelButton() {
  const tray = AstalTray.get_default();

  const createTrayItemButton = (item: AstalTray.TrayItem) => {
    return (
      <menubutton
        cssClasses={["tray-item-button", "button"]} // ensure it inherits button style
        setup={(self) => {
          if (!item.menuModel) return;

          const popoverMenu = Gtk.PopoverMenu.new_from_model(item.menuModel);
          popoverMenu.add_css_class("tray-menu");

          if (item.actionGroup) {
            popoverMenu.insert_action_group("dbusmenu", item.actionGroup);
          }

          self.set_popover(popoverMenu);

          const actionGroupHandler = item.connect(
            "notify::action-group",
            () => {
              if (item.actionGroup) {
                popoverMenu.insert_action_group("dbusmenu", item.actionGroup);
              }
            },
          );

          const popoverStateHandler = popoverMenu.connect(
            "notify::visible",
            () => {
              if (!popoverMenu.visible) self.set_active(false);
            },
          );

          const destroyHandler = self.connect("destroy", () => {
            try {
              item.disconnect(actionGroupHandler);
              popoverMenu.disconnect(popoverStateHandler);
            } catch (e) {
              console.error("Tray cleanup error:", e);
            }
          });

          (self as any)._trayHandlers = {
            actionGroupHandler,
            popoverStateHandler,
            destroyHandler,
          };
        }}
        tooltipText={bind(item, "tooltipMarkup")}
        sensitive={bind(item, "status").as(
          (status) => status !== AstalTray.Status.PASSIVE,
        )}
        child={
          <image
            gicon={bind(item, "gicon")}
            pixelSize={16}
            setup={(imageWidget) => {
              bind(item, "gicon").subscribe((gicon) => {
                imageWidget.visible = !!gicon;
              });
            }}
          />
        }
      />
    );
  };

  return (
    <box
      cssClasses={["tray_style"]}
      spacing={4}
      marginBottom={1}
      halign={Gtk.Align.END}
      valign={Gtk.Align.CENTER}
      homogeneous={false}
    >
      {bind(tray, "items").as((items) =>
        (items ?? [])
          .filter(
            (item) =>
              item && item.status !== AstalTray.Status.PASSIVE && item.gicon,
          )
          .map((item, index) => {
            const button = createTrayItemButton(item);
            (button as any).name = `tray-item-${item.id ?? index}`;
            return button;
          }),
      )}
    </box>
  );
}
