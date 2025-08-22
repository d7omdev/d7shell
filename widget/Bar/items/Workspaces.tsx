import { Gtk } from "astal/gtk4";
import AstalHyprland from "gi://AstalHyprland";
import { bind } from "astal";
import { Variable } from "astal";
import { ButtonProps } from "astal/gtk4/widget";
import options from "../../../option";

type WsButtonProps = ButtonProps & {
  ws: AstalHyprland.Workspace;
  isDummy?: boolean;
};

function WorkspaceButton({ ws, isDummy = false, ...props }: WsButtonProps) {
  const hyprland = AstalHyprland.get_default();
  const classNames = Variable.derive(
    [bind(hyprland, "focusedWorkspace"), bind(hyprland, "clients")],
    (fws) => {
      if (!fws || !ws) return ["workspace-button"];
      const classes = ["workspace-button"];

      const active = fws.id == ws.id;
      if (active) classes.push("active");

      if (isDummy) {
        return classes;
      }

      const occupied = ws.get_clients().length > 0;
      if (occupied) classes.push("occupied");

      return classes;
    },
  );

  return (
    <button
      cssClasses={classNames()}
      tooltip_text={`Workspace #${ws.id}`}
      onDestroy={() => classNames.drop()}
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      onClicked={() => {
        if (isDummy) {
          hyprland.dispatch("workspace", ws.id.toString());
        } else {
          ws.focus();
        }
      }}
      // child={<label label={ws.id.toString()} />}
      {...props}
    />
  );
}

export default function WorkspacesPanelButton() {
  const hyprland = AstalHyprland.get_default();

  const workspaceList = Variable.derive(
    [bind(hyprland, "focusedWorkspace"), bind(options.bar.workspacses.count)],
    (focusedWorkspace, workspaceCount) => {
      const existingWorkspaces = (
        hyprland.get_workspaces
          ? hyprland.get_workspaces()
          : hyprland.workspaces
      )
        .slice()
        .sort((a, b) => a.id - b.id);

      const workspaceMap = new Map(existingWorkspaces.map((ws) => [ws.id, ws]));

      const currentWorkspaceId = focusedWorkspace?.id || 1;

      const groupNumber = Math.floor((currentWorkspaceId - 1) / workspaceCount);
      const startId = groupNumber * workspaceCount + 1;
      const endId = startId + workspaceCount - 1;

      const allWorkspaces = [];
      for (let i = startId; i <= endId; i++) {
        const existingWs = workspaceMap.get(i);
        if (existingWs) {
          allWorkspaces.push({
            ws: existingWs,
            isDummy: false,
          });
        } else {
          const dummyWs = AstalHyprland.Workspace.dummy(i, null);

          allWorkspaces.push({
            ws: dummyWs,
            isDummy: true,
          });
        }
      }

      return allWorkspaces;
    },
  );

  return (
    <box
      cssClasses={["workspace-container"]}
      spacing={4}
      marginTop={1}
      marginBottom={3}
    >
      {bind(workspaceList).as((workspaces) =>
        workspaces.map(({ ws, isDummy }) => (
          <WorkspaceButton ws={ws} isDummy={isDummy} />
        )),
      )}
    </box>
  );
}
