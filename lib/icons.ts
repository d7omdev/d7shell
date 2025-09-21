import { Gdk, Gtk } from "astal/gtk4";
import Apps from "gi://AstalApps";

function getIconFromApps(appName: string): string {
  if (!appName) return "application-x-executable";

  try {
    const apps = new Apps.Apps({
      nameMultiplier: 2,
      entryMultiplier: 0,
      executableMultiplier: 2,
    });
    const appsIcon = apps.fuzzy_query(appName);
    for (const app of appsIcon) {
      const icon = app.get_icon_name();
      if (icon) return icon;
    }
  } catch (error) {
    console.error("Error querying apps:", error);
  }
  return "application-x-executable";
}

export function lookUpIcon(iconName: string | null | undefined): string {
  if (!iconName) {
    return "application-x-executable";
  }

  const display = Gdk.Display.get_default();
  if (!display) {
    console.error("No display found");
    return "application-x-executable";
  }

  const iconTheme = Gtk.IconTheme.get_for_display(display);

  const appsIcon = getIconFromApps(iconName);
  if (appsIcon && appsIcon !== "application-x-executable") {
    return appsIcon;
  }

  const possibleNames = [
    iconName.toLowerCase(),
    iconName.toLowerCase().replace(/\s/g, "-"),
    iconName.toLowerCase().replace(/\s/g, ""),
    iconName.toLowerCase().replace(/[^a-z0-9]/g, ""),
  ];

  for (const name of possibleNames) {
    if (iconTheme.has_icon(name)) {
      return name;
    }

    const variants = [
      `com.${name}`,
      `org.${name}`,
      `${name}.desktop`,
      `application-x-${name}`,
      `${name}-symbolic`,
      `${name}-symbolic.symbolic`,
    ];

    for (const variant of variants) {
      if (iconTheme.has_icon(variant)) {
        return variant;
      }
    }
  }

  console.log("No icon found for:", iconName, "using fallback");
  return "application-x-executable";
}
