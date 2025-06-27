import { GLib, Gio, execAsync, monitorFile, timeout } from "astal";
import { App } from "astal/gtk4";

export function monitorColorsChange() {
  const styleDir = `${GLib.getenv("HOME")}/Projects/d7shell/style`;
  let isCompiling = false;
  let lastCompilationTime = 0;

  function findScssFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const file = Gio.File.new_for_path(dir);
      const enumerator = file.enumerate_children(
        "standard::name,standard::type",
        Gio.FileQueryInfoFlags.NONE,
        null,
      );

      let info: Gio.FileInfo | null;
      while ((info = enumerator.next_file(null))) {
        const name = info.get_name();
        const fileType = info.get_file_type();
        const fullPath = `${dir}/${name}`;

        if (fileType === Gio.FileType.DIRECTORY) {
          files.push(...findScssFiles(fullPath));
        } else if (
          fileType === Gio.FileType.REGULAR &&
          name.endsWith(".scss")
        ) {
          files.push(fullPath);
        }
      }

      enumerator.close(null);
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }

    return files;
  }

  function compileCSS() {
    const now = GLib.get_real_time();
    if (isCompiling || now - lastCompilationTime < 500000) {
      // 500ms debounce
      console.log(`⏳ CSS compilation skipped (debounced or in progress)`);
      return;
    }

    isCompiling = true;
    lastCompilationTime = now;
    const target = "/tmp/astal/style.css";

    execAsync(
      `sass ${styleDir}/main.scss ${target} --no-charset --style=compressed`,
    )
      .then(() => {
        // Add a longer delay to ensure file is fully written and stable
        timeout(200, () => {
          try {
            // Check if file exists and is readable
            const file = Gio.File.new_for_path(target);
            if (!file.query_exists(null)) {
              console.error(`❌ CSS file not found: ${target}`);
              isCompiling = false;
              return;
            }

            App.reset_css();
            App.apply_css(target, true);
            console.log(`✅ CSS updated successfully`);
          } catch (error) {
            console.error(`❌ CSS application failed: ${error}`);
          } finally {
            isCompiling = false;
          }
        });
      })
      .catch((error) => {
        console.error(`❌ CSS compilation failed: ${error}`);
        isCompiling = false;
      });
  }

  const scssFiles = findScssFiles(styleDir);

  scssFiles.forEach((file) => {
    monitorFile(file, () => {
      const fileName = file.split("/").pop();
      const timestamp = new Date().toLocaleTimeString();
      console.log(`🔄 [${timestamp}] SCSS file changed: ${fileName}`);

      // Simple debounced compilation
      timeout(100, () => {
        compileCSS();
      });
    });
  });
}
