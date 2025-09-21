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

    const sortedClients = clients.as((clients) =>
        clients
            .filter((client) => client.workspace !== null)
            .sort((a, b) => a.workspace.id - b.workspace.id),
    );

    return (
        <box orientation={Gtk.Orientation.HORIZONTAL} spacing={4}>
            <revealer
                transitionType={Gtk.RevealerTransitionType.CROSSFADE}
                transitionDuration={300}
                reveal_child={clients.as((clientsList) => clientsList.length > 0)}
                child={
                    <box
                        spacing={4}
                        margin_top={1}
                        margin_bottom={1}
                        cssClasses={["bar_module", "on", "active-apps-container"]}
                    >
                        {sortedClients.as((clientsList) => {
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
                                            <box
                                                children={[
                                                    <image
                                                        margin_top={4}
                                                        margin_bottom={4}
                                                        tooltip_text={tooltipBinding}
                                                        cssClasses={focused.as((focusedClient) => {
                                                            const isActive =
                                                                focusedClient?.pid === client.pid;
                                                            return isActive
                                                                ? ["active-app"]
                                                                : ["inactive-app"];
                                                        })}
                                                        iconName={clientClassBinding.as((name) =>
                                                            lookUpIcon(name),
                                                        )}
                                                        pixelSize={18}
                                                    />,
                                                    <overlay>
                                                        <label
                                                            label={client.workspace.id.toString()}
                                                            cssClasses={["workspace_num"]}
                                                            type="overlay"
                                                        />
                                                    </overlay>,
                                                ]}
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
                marginBottom={2}
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
