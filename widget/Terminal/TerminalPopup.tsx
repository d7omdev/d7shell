import { App, Astal, Gtk, hook } from "astal/gtk4";
import { Variable } from "astal";
import { GLib } from "astal";
import PopupWindow from "../../common/PopupWindow";

const terminalOutput = Variable("");
const commandHistory = Variable<string[]>([]);
const currentInput = Variable("");
const isRunning = Variable(false);

export const TERMINAL_WINDOW_NAME = "terminal-popup";

function hide() {
  App.get_window(TERMINAL_WINDOW_NAME)?.set_visible(false);
}

export function show() {
  const window = App.get_window(TERMINAL_WINDOW_NAME);
  if (window) {
    window.set_visible(true);
    window.present();
  }
}

function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      isRunning.set(true);

      const [success, , , stdout, stderr] = GLib.spawn_async_with_pipes(
        GLib.get_home_dir(), // working directory
        ["/bin/bash", "-c", command],
        null, // envp
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null, // child_setup
      );

      if (!success) {
        isRunning.set(false);
        reject(new Error("Failed to spawn process"));
        return;
      }

      // Read stdout
      const stdoutChannel = GLib.IOChannel.unix_new(stdout);
      stdoutChannel.set_encoding(null);
      stdoutChannel.set_flags(GLib.IOFlags.NONBLOCK);

      // Read stderr
      const stderrChannel = GLib.IOChannel.unix_new(stderr);
      stderrChannel.set_encoding(null);
      stderrChannel.set_flags(GLib.IOFlags.NONBLOCK);

      let output = "";
      let errorOutput = "";

      const readOutput = () => {
        try {
          // Read stdout
          let stdoutData = "";
          try {
            const [status, data] = stdoutChannel.read_to_end();
            if (status === GLib.IOStatus.NORMAL && data) {
              stdoutData = new TextDecoder().decode(data);
            }
          } catch (e) {
            // Ignore read errors for non-blocking IO
          }

          // Read stderr
          let stderrData = "";
          try {
            const [status, data] = stderrChannel.read_to_end();
            if (status === GLib.IOStatus.NORMAL && data) {
              stderrData = new TextDecoder().decode(data);
            }
          } catch (e) {
            // Ignore read errors for non-blocking IO
          }

          if (stdoutData) {
            output += stdoutData;
            terminalOutput.set(terminalOutput.get() + stdoutData);
          }

          if (stderrData) {
            errorOutput += stderrData;
            terminalOutput.set(terminalOutput.get() + stderrData);
          }

          return true; // Continue polling
        } catch (error) {
          isRunning.set(false);
          resolve(output + errorOutput);
          return false; // Stop polling
        }
      };

      // Poll for output
      const timeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        100,
        readOutput,
      );

      // Wait for process to complete with a simple timeout approach
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
        try {
          GLib.source_remove(timeoutId);
        } catch (e) {
          // Source might already be removed
        }
        isRunning.set(false);
        resolve(output + errorOutput);
        return false;
      });

      // Fallback timeout
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
        try {
          GLib.source_remove(timeoutId);
        } catch (e) {
          // Source might already be removed
        }
        isRunning.set(false);
        resolve(output + errorOutput);
        return false;
      });
    } catch (err) {
      isRunning.set(false);
      reject(err);
    }
  });
}

export function runCommandInTerminal(command: string) {
  // Clear previous output and show window
  terminalOutput.set(`$ ${command}\n`);

  // Add to history
  const history = commandHistory.get();
  history.push(command);
  commandHistory.set(history);

  // Show window after setting up content
  show();

  executeCommand(command)
    .then((output) => {
      if (output.trim()) {
        terminalOutput.set(terminalOutput.get() + output + "\n");
      }
      terminalOutput.set(terminalOutput.get() + "\n$ ");
    })
    .catch((error) => {
      terminalOutput.set(
        terminalOutput.get() + `Error: ${error.message}\n\n$ `,
      );
    });
}

function TerminalOutput() {
  const textView = new Gtk.TextView({
    editable: false,
    cursorVisible: false,
    wrapMode: Gtk.WrapMode.WORD_CHAR,
    monospace: true,
  });
  textView.add_css_class("terminal-output");

  hook(textView, terminalOutput, () => {
    const buffer = textView.get_buffer();
    const text = terminalOutput.get();
    buffer.set_text(text, text.length);

    // Auto-scroll to bottom
    const mark = buffer.get_insert();
    textView.scroll_mark_onscreen(mark);
  });

  return (
    <Gtk.ScrolledWindow
      vexpand
      hexpand
      cssClasses={["terminal-scroll"]}
      vscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      hscrollbarPolicy={Gtk.PolicyType.AUTOMATIC}
      child={textView}
    />
  );
}

function TerminalInput() {
  const onEnter = () => {
    const command = currentInput.get().trim();
    if (command && !isRunning.get()) {
      currentInput.set("");
      runCommandInTerminal(command);
    }
  };

  return (
    <entry
      cssClasses={["terminal-input"]}
      placeholderText="Enter command..."
      text={currentInput.get()}
      setup={(self) => {
        currentInput.subscribe((text) => {
          if (self.get_text() !== text) {
            self.set_text(text);
          }
        });

        // Handle focus events properly (GTK4)
        self.connect("notify::has-focus", () => {
          // Focus handling if needed
        });
      }}
      onChanged={(self) => currentInput.set(self.text)}
      onActivate={onEnter}
      sensitive={isRunning((running) => !running)}
    />
  );
}

export default function TerminalPopup() {
  return (
    <PopupWindow
      anchor={(Astal.WindowAnchor.LEFT, Astal.WindowAnchor.RIGHT)}
      name={TERMINAL_WINDOW_NAME}
      setup={(self) => {
        self.connect("close-request", () => {
          hide();
          return true;
        });

        // Set initial size - wider and shorter
        self.set_default_size(1000, 350);

        // Focus the input when window is shown
        self.connect("notify::visible", () => {
          if (self.visible) {
            // Small delay to ensure the window is fully rendered
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
              const input = self.child
                ?.get_first_child()
                ?.get_last_child()
                ?.get_last_child();
              if (input && "grab_focus" in input) {
                (input as any).grab_focus();
              }
              return false;
            });
          }
        });
      }}
      margin={20}
      layout="center"
      child={
        <box
          cssClasses={["terminal-container"]}
          vertical
          spacing={0}
          child={
            <>
              <box cssClasses={["terminal-header"]} spacing={8}>
                <label cssClasses={["terminal-title"]} label="Terminal" />
                <box hexpand />
                <button
                  cssClasses={["terminal-close"]}
                  onClicked={hide}
                  child={<label label="✕" />}
                />
              </box>

              <TerminalOutput />

              <box cssClasses={["terminal-input-container"]} spacing={8}>
                <label cssClasses={["terminal-prompt"]} label="$" />
                <TerminalInput />
              </box>
            </>
          }
        />
      }
    />
  );
}
