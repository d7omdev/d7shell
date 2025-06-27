import { GLib, Gio, execAsync } from "astal";

export const cacheDir = `${GLib.get_user_cache_dir()}/d7shell`;

export function dependencies(packages: string[]) {
  for (const pkg of packages) {
    const result = GLib.find_program_in_path(pkg);
    if (!result) {
      return false;
    }
  }
  return true;
}

export function ensureDirectory(path: string) {
  if (!GLib.file_test(path, GLib.FileTest.EXISTS))
    Gio.File.new_for_path(path).make_directory_with_parents(null);
}

export async function sh(cmd: string | string[]) {
  return execAsync(cmd).catch((err) => {
    console.error(typeof cmd === "string" ? cmd : cmd.join(" "), err);
    return "";
  });
}

export async function bash(
  strings: TemplateStringsArray | string,
  ...values: unknown[]
) {
  const cmd =
    typeof strings === "string"
      ? strings
      : strings.flatMap((str, i) => str + `${values[i] ?? ""}`).join("");

  return execAsync(["bash", "-c", cmd]).catch((err) => {
    console.error(cmd, err);
    return "";
  });
}
