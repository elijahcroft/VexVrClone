import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as En from "blockly/msg/en";
import { COLORS } from "./blocks/defs";
import "./generate";

Blockly.setLocale(En as unknown as Record<string, string>);

const number = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const text = (t: string) => ({ shadow: { type: "text", fields: { TEXT: t } } });
const block = (type: string, inputs?: Record<string, unknown>) => ({ kind: "block", type, inputs });
const label = (text: string) => ({ kind: "label", text });

const TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Drivetrain",
      colour: COLORS.drivetrain,
      contents: [
        block("vr_drive"),
        block("vr_drive_for", { DISTANCE: number(200) }),
        block("vr_turn"),
        block("vr_turn_for", { ANGLE: number(90) }),
        block("vr_turn_to_heading", { ANGLE: number(90) }),
        block("vr_turn_to_rotation", { ANGLE: number(90) }),
        block("vr_stop_driving"),
        block("vr_set_drive_velocity", { VELOCITY: number(50) }),
        block("vr_set_turn_velocity", { VELOCITY: number(50) }),
        block("vr_set_drive_heading", { ANGLE: number(0) }),
        block("vr_set_drive_rotation", { ANGLE: number(0) }),
        block("vr_set_drive_timeout", { TIME: number(1) }),
      ],
    },
    {
      kind: "category",
      name: "Looks",
      colour: COLORS.looks,
      contents: [
        block("vr_print", { VALUE: text("Hello") }),
        block("vr_next_row"),
        block("vr_clear_rows"),
        block("vr_print_precision"),
        block("vr_print_color"),
      ],
    },
    {
      kind: "category",
      name: "Events",
      colour: COLORS.events,
      contents: [
        block("vr_when_started"),
        block("vr_when_i_receive"),
        block("vr_broadcast"),
        block("vr_broadcast_wait"),
      ],
    },
    {
      kind: "category",
      name: "Control",
      colour: COLORS.control,
      contents: [
        block("vr_wait", { TIME: number(1) }),
        block("vr_repeat", { TIMES: number(10) }),
        block("vr_forever"),
        block("vr_if"),
        block("vr_if_else"),
        block("vr_wait_until"),
        block("vr_repeat_until"),
        block("vr_while"),
        block("vr_break"),
        block("vr_stop_project"),
      ],
    },
    {
      kind: "category",
      name: "Sensing",
      colour: COLORS.sensing,
      contents: [
        label("Brain"),
        block("vr_reset_timer"),
        block("vr_timer"),
        label("Drivetrain"),
        block("vr_drive_is_done"),
        block("vr_drive_is_moving"),
        block("vr_drive_heading"),
        block("vr_drive_rotation"),
        label("Location"),
        block("vr_position"),
        block("vr_position_angle"),
      ],
    },
    {
      kind: "category",
      name: "Operators",
      colour: COLORS.operators,
      contents: [
        block("vr_arith", { A: number(0), B: number(0) }),
        block("vr_random", { FROM: number(1), TO: number(10) }),
        block("vr_compare", { A: number(0), B: number(50) }),
        block("vr_and_or"),
        block("vr_not"),
        block("vr_join", { A: text("apple "), B: text("banana") }),
        block("vr_letter_of", { INDEX: number(1), TEXT: text("apple") }),
        block("vr_length_of", { TEXT: text("apple") }),
        block("vr_contains", { TEXT: text("apple"), PART: text("a") }),
        block("vr_mod", { A: number(0), B: number(0) }),
        block("vr_round", { A: number(0) }),
        block("vr_math_fn", { A: number(0) }),
      ],
    },
    { kind: "category", name: "Variables", colour: "#ff8c1a", custom: "VR_VARIABLES" },
    { kind: "category", name: "My Blocks", colour: "#ff6680", custom: "PROCEDURE" },
  ],
};

const theme = Blockly.Theme.defineTheme("robocode", {
  name: "robocode",
  base: Blockly.Themes.Classic,
  blockStyles: {
    variable_blocks: { colourPrimary: "#ff8c1a" },
    procedure_blocks: { colourPrimary: "#ff6680" },
    math_blocks: { colourPrimary: COLORS.operators },
    text_blocks: { colourPrimary: COLORS.operators },
  } as Record<string, Partial<Blockly.Theme.BlockStyle>>,
  componentStyles: {
    workspaceBackgroundColour: "#f6f7fb",
    toolboxBackgroundColour: "#ffffff",
    flyoutBackgroundColour: "#eef0f6",
    flyoutOpacity: 1,
  },
  fontStyle: { family: "system-ui, sans-serif", weight: "600", size: 11 },
});

/** Variables flyout with number shadows already in place, Scratch-style. */
function variablesFlyout(ws: Blockly.WorkspaceSvg) {
  const items: object[] = [{ kind: "button", text: "Make a Variable", callbackkey: "VR_CREATE_VARIABLE" }];
  const vars = ws.getVariableMap().getVariablesOfType("");
  if (vars.length) {
    const first = { VAR: { id: vars[0].getId() } };
    items.push({ kind: "block", type: "variables_set", fields: first, inputs: { VALUE: number(0) } });
    items.push({ kind: "block", type: "math_change", fields: first, inputs: { DELTA: number(1) } });
    for (const v of vars) items.push({ kind: "block", type: "variables_get", fields: { VAR: { id: v.getId() } } });
  }
  return items as Blockly.utils.toolbox.FlyoutItemInfoArray;
}

export const DEFAULT_BLOCKS = {
  blocks: { languageVersion: 0, blocks: [{ type: "vr_when_started", x: 60, y: 60 }] },
};

export function createBlocksEditor(container: HTMLElement) {
  const ws = Blockly.inject(container, {
    toolbox: TOOLBOX,
    renderer: "zelos",
    theme,
    trashcan: true,
    zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 },
    move: { scrollbars: true, drag: true, wheel: false },
    grid: { spacing: 40, length: 2, colour: "#dfe2ea", snap: false },
  });
  ws.registerToolboxCategoryCallback("VR_VARIABLES", variablesFlyout);
  ws.registerButtonCallback("VR_CREATE_VARIABLE", (button) =>
    Blockly.Variables.createVariableButtonHandler(button.getTargetWorkspace()),
  );
  return ws;
}

export function loadBlocks(ws: Blockly.WorkspaceSvg, state: object) {
  ws.clear();
  Blockly.serialization.workspaces.load(state, ws);
}

export function saveBlocks(ws: Blockly.WorkspaceSvg) {
  return Blockly.serialization.workspaces.save(ws);
}
