import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { python, pythonLanguage } from "@codemirror/lang-python";
import { completeFromList } from "@codemirror/autocomplete";

/** Starting code for a new Python project. */
export const DEFAULT_PYTHON = `# Add project code in "main"
def main():
    drivetrain.drive_for(FORWARD, 200, MM)
    drivetrain.turn_for(RIGHT, 90, DEGREES)

# Start main as a thread; keep this line
vr_thread(main)
`;

const API = [
  "drivetrain.drive(FORWARD)",
  "drivetrain.drive_for(FORWARD, 200, MM)",
  "drivetrain.turn(RIGHT)",
  "drivetrain.turn_for(RIGHT, 90, DEGREES)",
  "drivetrain.turn_to_heading(90, DEGREES)",
  "drivetrain.turn_to_rotation(90, DEGREES)",
  "drivetrain.stop()",
  "drivetrain.set_drive_velocity(50, PERCENT)",
  "drivetrain.set_turn_velocity(50, PERCENT)",
  "drivetrain.set_heading(0, DEGREES)",
  "drivetrain.set_rotation(0, DEGREES)",
  "drivetrain.set_timeout(1, SECONDS)",
  "drivetrain.heading(DEGREES)",
  "drivetrain.rotation(DEGREES)",
  "drivetrain.is_done()",
  "drivetrain.is_moving()",
  "location.position(X, MM)",
  "location.position_angle(DEGREES)",
  "brain.print()",
  "brain.new_line()",
  "brain.clear()",
  "brain.set_print_color(RED)",
  "brain.timer.time(SECONDS)",
  "brain.timer.reset()",
  "wait(1, SECONDS)",
  "vr_thread(main)",
  "stop_project()",
  "Event()",
];
const CONSTANTS = "FORWARD REVERSE LEFT RIGHT MM INCHES DEGREES PERCENT SECONDS MSEC X Y RED GREEN BLUE BLACK".split(" ");

const completions = completeFromList([
  ...API.map((label) => ({ label, type: "function", apply: label })),
  ...CONSTANTS.map((label) => ({ label, type: "constant" })),
]);

export function createPythonEditor(parent: HTMLElement, onChange: () => void) {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: DEFAULT_PYTHON,
      extensions: [
        basicSetup,
        python(),
        pythonLanguage.data.of({ autocomplete: completions }),
        EditorView.updateListener.of((u) => u.docChanged && onChange()),
        EditorState.tabSize.of(4),
      ],
    }),
  });
}

export function setPythonCode(view: EditorView, code: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
}

/** Select a line, e.g. where an error happened. */
export function selectLine(view: EditorView, line: number) {
  if (line < 1 || line > view.state.doc.lines) return;
  const l = view.state.doc.line(line);
  view.dispatch({ selection: { anchor: l.from, head: l.to }, scrollIntoView: true });
  view.focus();
}
