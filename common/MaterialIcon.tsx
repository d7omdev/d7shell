type IconSize =
  | "gigantic"
  | "massive"
  | "hugerass"
  | "hugeass"
  | "larger"
  | "large"
  | "norm"
  | "small"
  | "smallie"
  | "smaller"
  | "tiny"
  | "poof";

function MaterialIcon({
  iconName,
  size = "norm",
  classes = [],
}: {
  iconName: string;
  size?: IconSize;
  classes?: string[];
}) {
  return (
    <label
      cssClasses={["icon-material", `txt-${size}`, ...classes]}
      label={iconName}
    />
  );
}

export default MaterialIcon;
