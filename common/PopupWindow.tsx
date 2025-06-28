import { App, Astal, Gdk, Gtk } from "astal/gtk4";
import { WindowProps } from "astal/gtk4/widget";

function Padding({ winName }: { winName: string }) {
  return (
    <button
      cssClasses={["button-padding"]}
      canFocus={false}
      onClicked={() => App.toggle_window(winName)}
      hexpand
      vexpand
    />
  );
}

function Layout({
  child = null,
  name,
  position,
}: {
  child: JSX.Element | null;
  name: string;
  position: string;
}) {
  if (!child) return null;
  switch (position) {
    case "top":
      return (
        <box vertical>
          {child}
          <Padding winName={name} />
        </box>
      );
    case "top_center":
      return (
        <box>
          <Padding winName={name} />
          <box vertical hexpand={false}>
            {child}
            <Padding winName={name} />
          </box>
          <Padding winName={name} />
        </box>
      );
    case "top_left":
      return (
        <box>
          <box vertical hexpand={false}>
            {child}
            <Padding winName={name} />
          </box>
          <Padding winName={name} />
        </box>
      );
    case "top_right":
      return (
        <box>
          <Padding winName={name} />
          <box vertical hexpand={false}>
            {child}
            <Padding winName={name} />
          </box>
        </box>
      );
    case "bottom":
      return (
        <box vertical>
          <Padding winName={name} />
          {child}
        </box>
      );
    case "bottom_center":
      return (
        <box>
          <Padding winName={name} />
          <box vertical hexpand={false}>
            <Padding winName={name} />
            {child}
          </box>
          <Padding winName={name} />
        </box>
      );
    case "bottom_left":
      return (
        <box>
          <box vertical hexpand={false}>
            <Padding winName={name} />
            {child}
          </box>
          <Padding winName={name} />
        </box>
      );
    case "bottom_right":
      return (
        <box>
          <Padding winName={name} />
          <box vertical hexpand={false}>
            <Padding winName={name} />
            {child}
          </box>
        </box>
      );
    //default to center
    default:
      return (
        <centerbox>
          <Padding winName={name} />
          {/* @ts-ignore-next-line */}
          <centerbox orientation={Gtk.Orientation.VERTICAL}>
            <Padding winName={name} />
            {child}
            <Padding winName={name} />
          </centerbox>
          <Padding winName={name} />
        </centerbox>
      );
  }
}

type PopupWindowProps = WindowProps & {
  child?: JSX.Element | null;
  name: string;
  visible?: boolean;
  layout?: string;
};

export default function PopupWindow({
  child,
  name,
  visible,
  layout = "center",
  ...props
}: PopupWindowProps) {
  const { TOP, RIGHT, BOTTOM, LEFT } = Astal.WindowAnchor;

  return (
    <window
      visible={visible ?? false}
      name={name}
      namespace={name}
      layer={Astal.Layer.TOP}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={App}
      anchor={TOP | BOTTOM | RIGHT | LEFT}
      onKeyPressed={(_, keyval) => {
        if (keyval === Gdk.KEY_Escape) {
          App.toggle_window(name);
        }
      }}
      {...props}
      child={<Layout name={name} position={layout} child={child ?? null} />}
    />
  );
}
