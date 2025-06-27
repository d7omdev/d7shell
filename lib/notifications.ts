import { execAsync } from "astal";

type NotifUrgency = "low" | "normal" | "critical";

export function notifySend({
  appName,
  appIcon,
  urgency = "normal",
  image,
  icon,
  summary,
  body,
  actions,
}: {
  appName?: string;
  appIcon?: string;
  urgency?: NotifUrgency;
  image?: string;
  icon?: string;
  summary: string;
  body: string;
  actions?: {
    [label: string]: () => void;
  };
}) {
  const actionsArray = Object.entries(actions || {}).map(
    ([label, callback], i) => ({
      id: `${i}`,
      label,
      callback,
    }),
  );
  execAsync(
    [
      "notify-send",
      `-u ${urgency}`,
      appIcon && `-i ${appIcon}`,
      `-h "string:image-path:${icon ? icon : image}"`,
      `"${summary ?? ""}"`,
      `"${body ?? ""}"`,
      `-a "${appName ?? ""}"`,
      ...actionsArray.map((v) => `--action="${v.id}=${v.label}"`),
    ].join(" "),
  )
    .then((out) => {
      if (!isNaN(Number(out.trim())) && out.trim() !== "") {
        actionsArray[parseInt(out)].callback();
      }
    })
    .catch(console.error);
}
