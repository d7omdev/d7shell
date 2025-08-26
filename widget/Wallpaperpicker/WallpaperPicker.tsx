import { GLib, Gio } from "astal";
import PopupWindow from "../../common/PopupWindow";
import GdkPixbuf from "gi://GdkPixbuf";
import { App, Astal, Gtk, hook } from "astal/gtk4";
import options from "../../option";
import { bash, ensureDirectory, sh } from "../../lib/utils";

const { wallpaper } = options;
const { mode } = options.theme;
const cachePath = `${GLib.get_user_cache_dir()}/d7shell/wallpapers`;
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

// Cache state management
const wallpaperCache: Map<string, string[]> = new Map();
let wallpaperGrid: Astal.Box | null = null;

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

function createWallpaperButton(
  filename: string,
  path: string,
  modeNow: string,
) {
  return (
    <button
      canFocus
      cssClasses={["wall-button"]}
      tooltipText={filename}
      onClicked={async () => {
        const cached = cacheImage(
          `${path}/${filename}`,
          cachePath,
          450,
          `${filename.split(".")[0]}_current`,
        );
        await sh([
          "sh",
          `${GLib.getenv("HOME")}/Projects/d7shell/scripts/changecolor.sh`,
          `${path}/${filename}`,
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
            filename.toLowerCase().endsWith(".gif")
              ? `${path}/${filename}`
              : `${cachePath}/${filename}`,
          )}
        />
      }
    />
  );
}

async function populateBox(box: Astal.Box, path: string) {
  wallpaperGrid = box;
  const cacheKey = path;

  // Check if we already have cached file list for this path
  let files = wallpaperCache.get(cacheKey);

  if (!files) {
    // First time loading this path - get file list and cache it
    files = getWallpaperList(path);
    wallpaperCache.set(cacheKey, files);
  }

  const modeNow = mode.get();

  // Show cached wallpapers immediately if thumbnails exist
  const cachedFiles = files.filter((f) =>
    GLib.file_test(`${cachePath}/${f}`, GLib.FileTest.EXISTS),
  );

  if (cachedFiles.length > 0) {
    // Show cached wallpapers immediately
    box.set_children(
      cachedFiles.map((f) => createWallpaperButton(f, path, modeNow)),
    );
  } else {
    // Show loading message
    box.set_children([
      <label label="Loading wallpapers..." hexpand halign={Gtk.Align.CENTER} />,
    ]);
  }

  // Cache missing wallpapers in background
  const toCache = files.filter(
    (f) => !GLib.file_test(`${cachePath}/${f}`, GLib.FileTest.EXISTS),
  );

  if (toCache.length > 0) {
    // Cache thumbnails in background
    Promise.all(
      toCache.map((f) => cacheImage(`${path}/${f}`, cachePath, 200)),
    ).then(() => {
      // Update the UI with all wallpapers (cached + newly cached)
      if (wallpaperGrid) {
        wallpaperGrid.set_children(
          files.map((f) => createWallpaperButton(f, path, modeNow)),
        );
      }
    });
  }
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
            // Don't destroy the window - just hide it to preserve cache
            self.hide();
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
              onClicked={() => {
                if (GLib.file_test(cachePath, GLib.FileTest.IS_DIR)) {
                  bash(`rm -r ${cachePath}`);
                  wallpaperCache.clear();
                  // Refresh the current view
                  if (wallpaperGrid) {
                    populateBox(wallpaperGrid, wallpaper.folder.get());
                  }
                }
              }}
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
                      wallpaperCache.clear();
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
                    label="Loading wallpapers..."
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
  const existingWindow = App.get_window("wallpaperpicker");
  if (!existingWindow) {
    wallpaperPicker();
  } else {
    if (existingWindow.visible) {
      existingWindow.hide();
    } else {
      existingWindow.show();
    }
  }
}
