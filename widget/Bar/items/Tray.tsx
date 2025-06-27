import { bind } from "astal";
import { Gtk } from "astal/gtk4";
import AstalTray from "gi://AstalTray?version=0.1";

export default function TrayPanelButton() {
  const tray = AstalTray.get_default();

  const createTrayItemButton = (item: AstalTray.TrayItem) => {
    return (
      <menubutton
        setup={(self) => {
          if (!item.menuModel) {
            console.warn("Tray item missing menuModel:", item);
            return;
          }

          const popoverMenu = Gtk.PopoverMenu.new_from_model(item.menuModel);

          if (item.actionGroup) {
            popoverMenu.insert_action_group("dbusmenu", item.actionGroup);
          }

          self.set_popover(popoverMenu as Gtk.Popover);

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
              if (!popoverMenu.visible) {
                self.set_active(false);
              }
            },
          );

          const destroyHandler = self.connect("destroy", () => {
            try {
              if (item && actionGroupHandler) {
                item.disconnect(actionGroupHandler);
              }

              if (popoverMenu && popoverStateHandler) {
                popoverMenu.disconnect(popoverStateHandler);
              }
            } catch (error) {
              console.error("Error during tray item cleanup:", error);
            }
          });

          (self as any)._trayHandlers = {
            actionGroupHandler,
            popoverStateHandler,
            destroyHandler,
          };
        }}
        tooltipText={bind(item, "tooltipMarkup")}
        child={
          <image
            gicon={bind(item, "gicon")}
            pixelSize={16}
            setup={(imageWidget) => {
              const iconBinding = bind(item, "gicon");
              iconBinding.subscribe((gicon) => {
                imageWidget.visible = !!gicon;
              });
            }}
          />
        }
        sensitive={bind(item, "status").as(
          (status) => status !== AstalTray.Status.PASSIVE,
        )}
        cssClasses={["tray-item-button"]}
      />
    );
  };

  return (
    <box cssClasses={["tray_style"]} spacing={2}>
      {bind(tray, "items").as((items) => {
        if (!items || !Array.isArray(items)) {
          return [];
        }

        return items
          .filter((item) => {
            return (
              item && item.status !== AstalTray.Status.PASSIVE && item.gicon
            );
          })
          .map((item, index) => {
            const button = createTrayItemButton(item);

            if (item.id) {
              (button as any).name = `tray-item-${item.id}`;
            } else {
              (button as any).name = `tray-item-${index}`;
            }

            return button;
          });
      })}
    </box>
  );
}

export interface TrayItemData {
  id?: string;
  status: AstalTray.Status;
  gicon: any;
  menuModel: any;
  actionGroup?: any;
  tooltipMarkup?: string;
  tooltip?: string;
}

export function cleanupTrayButton(button: any) {
  if (button._trayHandlers) {
    const { destroyHandler } = button._trayHandlers;

    try {
      if (destroyHandler) {
        button.disconnect(destroyHandler);
      }
    } catch (error) {
      console.error("Error during manual tray button cleanup:", error);
    }
  }
}
