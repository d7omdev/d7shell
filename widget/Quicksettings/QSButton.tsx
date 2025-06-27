import { bind, Binding, Variable } from "astal";
import { Gtk } from "astal/gtk4";
import { ButtonProps, MenuButtonProps } from "astal/gtk4/widget";
import GObject from "gi://GObject?version=2.0";
import { Opt } from "../../lib/option";

type QSMenuButtonProps = MenuButtonProps & {
  popoverToSet?: Gtk.Widget; // Changed to Gtk.Widget to match set_popover signature
  child?: JSX.Element | null;
  iconName: string;
  label?: string; // Made optional since it's not used
};

export function QSMenuButton({
  popoverToSet,
  child,
  iconName,
  setup,
}: QSMenuButtonProps) {
  return (
    <menubutton
      setup={(self: Gtk.MenuButton) => {
        // Set popover in setup function to avoid type mismatch
        if (popoverToSet) {
          self.set_popover(popoverToSet);
        }
        // 执行用户传入的 setup
        if (setup) {
          setup(self);
        }
      }}
      cssClasses={["qs-button"]}
      child={
        <box>
          <image
            halign={Gtk.Align.CENTER}
            iconSize={Gtk.IconSize.NORMAL}
            iconName={iconName}
          />
          {child || <></>}
        </box>
      }
    />
  );
}

type QSButtonProps<T extends GObject.Object> = ButtonProps & {
  iconName: string | Binding<string>;
  label: string | Binding<string>;
  connection?: [
    T | Variable<unknown> | Opt<unknown>,
    keyof T | null,
    ((arg0: unknown) => boolean)?,
  ];
};

export default function QSButton<T extends GObject.Object>({
  iconName,
  label,
  setup,
  onClicked,
  connection,
}: QSButtonProps<T>) {
  function getCssClasses(): string[] | Binding<string[]> {
    if (!connection) return ["qs-button"];

    const [object, property, cond] = connection;
    const computeClasses = (v: unknown) => {
      const classes = ["qs-button"];
      if (cond ? cond(v) : v) classes.push("active");
      return classes;
    };

    return object instanceof Variable
      ? bind(object).as(computeClasses)
      : property != null
        ? bind(object, property).as(computeClasses)
        : ["qs-button"];
  }

  return (
    <button
      setup={setup}
      cssClasses={getCssClasses()}
      onClicked={onClicked}
      child={
        <box>
          <image
            iconName={iconName}
            iconSize={Gtk.IconSize.LARGE}
            halign={Gtk.Align.START}
          />
          <label xalign={0} label={label} />
        </box>
      }
    />
  );
}
