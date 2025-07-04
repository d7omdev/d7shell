import { bind, Binding } from "astal";
import { Gtk } from "astal/gtk4";
import Hyprland from "gi://AstalHyprland";
import Pango from "gi://Pango?version=1.0";
import { lookUpIcon } from "../../../lib/utils";

const hypr = Hyprland.get_default();

function FocusedAppLabels({
  focusedClient,
}: {
  focusedClient: Binding<Hyprland.Client> | null | undefined;
}) {
  if (!focusedClient) return <box />;

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={0}
      cssClasses={["focused-app-labels"]}
    >
      <label
        label={focusedClient.as((client) => {
          const appClass = client?.class || "";
          return appClass && appClass.length > 0 ? appClass.toUpperCase() : "";
        })}
        cssClasses={["app-class-label"]}
        xalign={0}
      />
      <label
        label={focusedClient.as((client) => {
          const appTitle = client?.title || "";
          return appTitle && appTitle.length > 0 ? appTitle : "";
        })}
        cssClasses={["app-title-label"]}
        ellipsize={Pango.EllipsizeMode.END}
        maxWidthChars={30}
        xalign={0}
      />
    </box>
  );
}

function FocusedWorkspaceLabel({
  focusedWorkspace,
}: {
  focusedWorkspace: Binding<Hyprland.Workspace> | null | undefined;
}) {
  if (!focusedWorkspace) return <box />;

  return (
    <box
      orientation={Gtk.Orientation.VERTICAL}
      spacing={0}
      cssClasses={["focused-app-labels"]}
    >
      <label label="DESKTOP" cssClasses={["app-class-label"]} xalign={0} />
      <label
        label={focusedWorkspace.as((workspace) => {
          const hasClients = workspace?.get_clients().length > 0;
          if (hasClients) return "";
          return workspace ? `Workspace #${workspace.id}` : "";
        })}
        cssClasses={["app-title-label"]}
        xalign={0}
      />
    </box>
  );
}

export default () => {
  const focused = bind(hypr, "focusedClient");
  const focusedWorkspace = bind(hypr, "focusedWorkspace");
  const clients = bind(hypr, "clients");

  return (
    <box orientation={Gtk.Orientation.HORIZONTAL} spacing={4}>
      <revealer
        transitionType={Gtk.RevealerTransitionType.CROSSFADE}
        transitionDuration={300}
        reveal_child={clients.as((clientsList) => clientsList.length > 0)}
        child={
          <box
            spacing={4}
            margin_top={2}
            margin_bottom={2}
            cssClasses={["bar_module", "on", "active-apps-container"]}
          >
            {clients.as((clientsList) => {
              return clientsList.map((client) => {
                const clientClassBinding = bind(client, "class");
                const tooltipBinding = bind(client, "class").as(
                  (className) => `${className}`,
                );

                return (
                  <button
                    onClicked={() => {
                      if (client.pid) {
                        hypr.dispatch("focuswindow", `pid:${client.pid}`);
                      } else if (client.address) {
                        hypr.dispatch(
                          "focuswindow",
                          `address:${client.address}`,
                        );
                      }
                    }}
                    child={
                      <image
                        margin_top={5}
                        margin_bottom={5}
                        tooltip_text={tooltipBinding}
                        cssClasses={focused.as((focusedClient) => {
                          const isActive = focusedClient?.pid === client.pid;
                          return isActive ? ["active-app"] : ["inactive-app"];
                        })}
                        iconName={clientClassBinding.as((name) =>
                          lookUpIcon(name),
                        )}
                        pixelSize={20}
                      />
                    }
                  />
                );
              });
            })}
          </box>
        }
      />
      <box
        child={focusedWorkspace.as((workspace) => {
          return workspace && workspace.get_clients().length > 0 ? (
            <FocusedAppLabels
              focusedClient={focused as Binding<Hyprland.Client>}
            />
          ) : (
            <FocusedWorkspaceLabel
              focusedWorkspace={focusedWorkspace as Binding<Hyprland.Workspace>}
            />
          );
        })}
      />
    </box>
  );
};
