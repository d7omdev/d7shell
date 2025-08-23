import { GLib, Gio, timeout } from "astal";
import PopupWindow from "../../common/PopupWindow";
import GdkPixbuf from "gi://GdkPixbuf";
import { App, Astal, Gtk, hook } from "astal/gtk4";
import options from "../../option";
import { bash, ensureDirectory, sh } from "../../lib/utils";

const { wallpaper } = options;
const { mode } = options.theme;
const cachePath = `${GLib.get_user_cache_dir()}/aiser-astal/wallpapers`;
const imageFormats = [
  ".jpeg",
  ".jpg",
  ".webp",
  ".png",
  ".gif",
  ".bmp",
  ".tiff",
  ".tga",
];

function getWallpaperList(path: string) {
  const dir = Gio.file_new_for_path(path);
  const fileEnum = dir.enumerate_children(
    "standard::name",
    Gio.FileQueryInfoFlags.NONE,
    null,
  );
  const files: string[] = [];
  let i = fileEnum.next_file(null);
  while (i) {
    const name = i.get_name();
    if (imageFormats.some((ext) => name.toLowerCase().endsWith(ext)))
      files.push(name);
    i = fileEnum.next_file(null);
  }
  return files;
}

function cacheImage(
  inputPath: string,
  cachePath: string,
  newWidth: number,
  customName?: string,
) {
  ensureDirectory(cachePath);
  const baseName = GLib.path_get_basename(inputPath);
  const ext = baseName.split(".").pop()!.toLowerCase();
  const outputFile = `${cachePath}/${customName ?? baseName}`;

  if (GLib.file_test(outputFile, GLib.FileTest.EXISTS)) return outputFile;

  try {
    if (ext === "gif") {
      Gio.File.new_for_path(inputPath).copy(
        Gio.File.new_for_path(outputFile),
        Gio.FileCopyFlags.OVERWRITE,
        null,
        null,
      );
      return outputFile;
    }

    const pixbuf = GdkPixbuf.Pixbuf.new_from_file(inputPath);
    const scaled =
      pixbuf.get_width() > newWidth
        ? pixbuf.scale_simple(
            newWidth,
            Math.round((newWidth * pixbuf.get_height()) / pixbuf.get_width()),
            GdkPixbuf.InterpType.BILINEAR,
          )
        : pixbuf;

    scaled?.savev(outputFile, ext === "png" ? "png" : "jpeg", [], []);
    return outputFile;
  } catch {
    return outputFile;
  }
}

async function populateBox(box: Astal.Box, path: string) {
  const files = getWallpaperList(path);
  const modeNow = mode.get();

  // Only cache missing wallpapers
  const toCache = files.filter(
    (f) => !GLib.file_test(`${cachePath}/${f}`, GLib.FileTest.EXISTS),
  );
  if (toCache.length > 0)
    await Promise.all(
      toCache.map((f) => cacheImage(`${path}/${f}`, cachePath, 200)),
    );

  // Populate GTK buttons once after caching
  box.set_children(
    files.map((f) => (
      <button
        canFocus
        cssClasses={["wall-button"]}
        tooltipText={f}
        onClicked={async () => {
          const cached = cacheImage(
            `${path}/${f}`,
            cachePath,
            450,
            `${f.split(".")[0]}_current`,
          );
          await sh([
            "sh",
            `${GLib.getenv("HOME")}/Projects/d7shell/scripts/changecolor.sh`,
            `${path}/${f}`,
            modeNow,
          ]);
          wallpaper.current.set(cached);
        }}
        child={
          <Gtk.Picture
            cssClasses={["picture"]}
            overflow={Gtk.Overflow.HIDDEN}
            contentFit={Gtk.ContentFit.COVER}
            widthRequest={200}
            heightRequest={80}
            file={Gio.file_new_for_path(
              f.toLowerCase().endsWith(".gif")
                ? `${path}/${f}`
                : `${cachePath}/${f}`,
            )}
          />
        }
      />
    )),
  );
}

function wallpaperPicker() {
  ensureDirectory(cachePath);

  return (
    <PopupWindow
      name="wallpaperpicker"
      layout="top"
      visible
      margin={10}
      widthRequest={1000}
      setup={(self) => {
        hook(self, App, "window-toggled", (_, win) => {
          if (win.name === "wallpaperpicker" && !win.visible) {
            self.set_child(null);
            self.destroy();
          }
        });
      }}
      child={
        <box
          vertical
          vexpand={false}
          cssClasses={["wallpaperpicker-container"]}
        >
          <box spacing={6}>
            <label useMarkup label="<b>Wallpaper</b>" hexpand xalign={0} />
            <box hexpand />
            <label cssClasses={["directory"]} label={wallpaper.folder()} />
            <button
              tooltipText="Clear cache"
              onClicked={() =>
                GLib.file_test(cachePath, GLib.FileTest.IS_DIR) &&
                bash(`rm -r ${cachePath}`)
              }
              iconName="user-trash-full-symbolic"
            />
            <button
              tooltipText="Change folder"
              onClicked={() => {
                App.get_window("wallpaperpicker")?.hide();
                const chooser = new Gtk.FileDialog({
                  title: "Choose Folder",
                  initialFolder: Gio.file_new_for_path(wallpaper.folder.get()),
                });
                chooser.select_folder(null, null, (_, res) => {
                  try {
                    const folder = chooser.select_folder_finish(res);
                    if (folder?.get_path()) {
                      wallpaper.folder.set(folder.get_path()!);
                      wallpaperPicker();
                    }
                  } catch (e) {
                    if (`${e}`.toLowerCase().includes("dismissed"))
                      wallpaperPicker();
                    else console.error(e);
                  }
                });
              }}
              iconName="folder-symbolic"
            />
          </box>

          <Gtk.Separator />

          <Gtk.ScrolledWindow
            child={
              <box
                spacing={6}
                vexpand
                setup={(self) => {
                  populateBox(self, wallpaper.folder.get());
                }}
                child={
                  <label
                    label="Caching wallpapers..."
                    hexpand
                    halign={Gtk.Align.CENTER}
                  />
                }
              />
            }
          />
        </box>
      }
    />
  );
}

export function toggleWallpaperPicker() {
  const exists = App.get_windows().some((w) => w.name === "wallpaperpicker");
  if (!exists) wallpaperPicker();
  else App.get_window("wallpaperpicker")?.hide();
}
