import { App, Gtk } from "astal/gtk4";
import { scrimWindowNames, transparentScrimWindowNames } from "./variables";

export function range(max: number) {
  return Array.from({ length: max + 1 }, (_, i) => i);
}

export const activePopupWindows = (scrimType: "transparent" | "opaque") => {
  const windowNames =
    scrimType === "transparent"
      ? transparentScrimWindowNames.get()
      : scrimWindowNames.get();

  return App.get_windows().filter(
    (window: { name: string; visible: boolean }) =>
      windowNames.includes(window.name) && window.visible,
  );
};

export function separatorBetween(
  elements: Gtk.Widget[],
  orientation: Gtk.Orientation,
) {
  const spacedElements: Gtk.Widget[] = [];

  elements.forEach((element, index) => {
    if (index > 0) {
      spacedElements.push(new Gtk.Separator({ orientation: orientation }));
    }
    spacedElements.push(element);
  });

  return spacedElements;
}
