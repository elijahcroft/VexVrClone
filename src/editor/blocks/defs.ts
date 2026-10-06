import * as Blockly from "blockly/core";
import { Order, type PythonGenerator } from "blockly/python";

/**
 * Block definitions and their Python. Wording and generated code follow
 * VEXcode VR so lessons and code carry over.
 */

export const COLORS = {
  lists: "#ff661a",
  drivetrain: "#4c97ff",
  magnet: "#cf63cf",
  looks: "#9966ff",
  events: "#ffbf00",
  control: "#ffab19",
  sensing: "#5cb1d6",
  operators: "#59c059",
};

type Gen = (block: Blockly.Block, g: PythonGenerator) => string | [string, number] | null;

interface BlockSpec {
  type: string;
  message0: string;
  args0?: object[];
  message1?: string;
  args1?: object[];
  message2?: string;
  args2?: object[];
  colour: string;
  output?: string | null;
  statement?: boolean;
  hat?: boolean;
  /** Ends a stack (forever, stop project). */
  cap?: boolean;
  inputsInline?: boolean;
  tooltip?: string;
  python: Gen;
}

const dropdown = (name: string, options: [string, string][]) => ({ type: "field_dropdown", name, options });
const value = (name: string, check?: string | string[]) => ({ type: "input_value", name, check });
const statements = (name: string) => ({ type: "input_statement", name });
const BUMPERS: [string, string][] = [
  ["left bumper", "left_bumper"],
  ["right bumper", "right_bumper"],
];
const EYES: [string, string][] = [
  ["front eye", "front_eye"],
  ["down eye", "down_eye"],
];
const DISTANCES: [string, string][] = [
  ["front distance", "front_distance"],
  ["down distance", "down_distance"],
];
const EYE_COLORS: [string, string][] = [
  ["red", "RED"],
  ["green", "GREEN"],
  ["blue", "BLUE"],
  ["none", "NONE"],
];
const WAIT_OPTIONS: [string, string][] = [
  ["▸", "WAIT"],
  ["and don't wait", "NOWAIT"],
];

/** Extra module-level lines blocks need (imports, Event objects). */
export const extraDefs = new Map<string, string>();
/** Lines that start hats: vr_thread(...), event registrations. */
export const registrations: string[] = [];
const hatCounts = new Map<string, number>();

export function resetGeneratorState() {
  extraDefs.clear();
  registrations.length = 0;
  hatCounts.clear();
}

const num = (b: Blockly.Block, g: PythonGenerator, name: string, order = Order.NONE) =>
  g.valueToCode(b, name, order) || "0";
const str = (b: Blockly.Block, g: PythonGenerator, name: string, order = Order.NONE) =>
  g.valueToCode(b, name, order) || '""';
const bool = (b: Blockly.Block, g: PythonGenerator, name: string, order = Order.NONE) =>
  g.valueToCode(b, name, order) || "False";
const body = (b: Blockly.Block, g: PythonGenerator, name: string) => g.statementToCode(b, name) || g.INDENT + "pass\n";
const field = (b: Blockly.Block, name: string) => b.getFieldValue(name) as string;
const listField = { type: "field_variable", name: "LIST", variable: "my list", variableTypes: ["List"], defaultType: "List" };
/** A list variable's Python name; also makes sure it starts as []. */
const list = (b: Blockly.Block, g: PythonGenerator) => {
  const name = g.getVariableName(field(b, "LIST"));
  extraDefs.set(`list ${name}`, `${name} = []`);
  return name;
};
const index = (b: Blockly.Block, g: PythonGenerator, name: string) => {
  const i = num(b, g, name);
  return /^\d+$/.test(i) ? String(Number(i) - 1) : `int(${i}) - 1`;
};
const waitArg = (b: Blockly.Block) => (field(b, "WAIT") === "NOWAIT" ? ", wait=False" : "");

/** Python identifier from a message name. */
const messageVar = (name: string) => "message_" + (name.replace(/[^A-Za-z0-9_]/g, "_") || "1");

/** `def name():` + globals + the stack under a hat. */
function hatFunction(block: Blockly.Block, g: PythonGenerator, base: string) {
  const n = (hatCounts.get(base) ?? 0) + 1;
  hatCounts.set(base, n);
  const name = `${base}_${n}`;
  const vars = Blockly.Variables.allUsedVarModels(block.workspace).map((v) => g.getVariableName(v.getId()));
  const globals = vars.length ? `${g.INDENT}global ${vars.join(", ")}\n` : "";
  const next = block.getNextBlock();
  const code = next ? g.prefixLines(g.blockToCode(next) as string, g.INDENT) : "";
  return { name, code: `def ${name}():\n${globals}${code || g.INDENT + "pass\n"}\n` };
}

const SPECS: BlockSpec[] = [
  // ---------------------------------------------------------- drivetrain
  {
    type: "vr_drive",
    message0: "drive %1",
    args0: [dropdown("DIR", [["forward", "FORWARD"], ["reverse", "REVERSE"]])],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b) => `drivetrain.drive(${field(b, "DIR")})\n`,
  },
  {
    type: "vr_drive_for",
    message0: "drive %1 for %2 %3 %4",
    args0: [
      dropdown("DIR", [["forward", "FORWARD"], ["reverse", "REVERSE"]]),
      value("DISTANCE", "Number"),
      dropdown("UNITS", [["mm", "MM"], ["inches", "INCHES"]]),
      dropdown("WAIT", WAIT_OPTIONS),
    ],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) =>
      `drivetrain.drive_for(${field(b, "DIR")}, ${num(b, g, "DISTANCE")}, ${field(b, "UNITS")}${waitArg(b)})\n`,
  },
  {
    type: "vr_turn",
    message0: "turn %1",
    args0: [dropdown("DIR", [["right", "RIGHT"], ["left", "LEFT"]])],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b) => `drivetrain.turn(${field(b, "DIR")})\n`,
  },
  {
    type: "vr_turn_for",
    message0: "turn %1 for %2 degrees %3",
    args0: [dropdown("DIR", [["right", "RIGHT"], ["left", "LEFT"]]), value("ANGLE", "Number"), dropdown("WAIT", WAIT_OPTIONS)],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.turn_for(${field(b, "DIR")}, ${num(b, g, "ANGLE")}, DEGREES${waitArg(b)})\n`,
  },
  {
    type: "vr_turn_to_heading",
    message0: "turn to heading %1 degrees %2",
    args0: [value("ANGLE", "Number"), dropdown("WAIT", WAIT_OPTIONS)],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.turn_to_heading(${num(b, g, "ANGLE")}, DEGREES${waitArg(b)})\n`,
  },
  {
    type: "vr_turn_to_rotation",
    message0: "turn to rotation %1 degrees %2",
    args0: [value("ANGLE", "Number"), dropdown("WAIT", WAIT_OPTIONS)],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.turn_to_rotation(${num(b, g, "ANGLE")}, DEGREES${waitArg(b)})\n`,
  },
  {
    type: "vr_stop_driving",
    message0: "stop driving",
    colour: COLORS.drivetrain,
    statement: true,
    python: () => "drivetrain.stop()\n",
  },
  {
    type: "vr_set_drive_velocity",
    message0: "set drive velocity to %1 %%",
    args0: [value("VELOCITY", "Number")],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.set_drive_velocity(${num(b, g, "VELOCITY")}, PERCENT)\n`,
  },
  {
    type: "vr_set_turn_velocity",
    message0: "set turn velocity to %1 %%",
    args0: [value("VELOCITY", "Number")],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.set_turn_velocity(${num(b, g, "VELOCITY")}, PERCENT)\n`,
  },
  {
    type: "vr_set_drive_heading",
    message0: "set drive heading to %1 degrees",
    args0: [value("ANGLE", "Number")],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.set_heading(${num(b, g, "ANGLE")}, DEGREES)\n`,
  },
  {
    type: "vr_set_drive_rotation",
    message0: "set drive rotation to %1 degrees",
    args0: [value("ANGLE", "Number")],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.set_rotation(${num(b, g, "ANGLE")}, DEGREES)\n`,
  },
  {
    type: "vr_set_drive_timeout",
    message0: "set drive timeout to %1 seconds",
    args0: [value("TIME", "Number")],
    colour: COLORS.drivetrain,
    statement: true,
    python: (b, g) => `drivetrain.set_timeout(${num(b, g, "TIME")}, SECONDS)\n`,
  },

  // --------------------------------------------------------------- looks
  {
    type: "vr_print",
    message0: "print %1 %2",
    args0: [value("VALUE"), dropdown("NEWLINE", [["▸", "NO"], ["and set cursor to next row", "YES"]])],
    colour: COLORS.looks,
    statement: true,
    python: (b, g) =>
      `brain.print(${str(b, g, "VALUE")})\n` + (field(b, "NEWLINE") === "YES" ? "brain.new_line()\n" : ""),
  },
  {
    type: "vr_next_row",
    message0: "set cursor to next row",
    colour: COLORS.looks,
    statement: true,
    python: () => "brain.new_line()\n",
  },
  {
    type: "vr_clear_rows",
    message0: "clear all rows",
    colour: COLORS.looks,
    statement: true,
    python: () => "brain.clear()\n",
  },
  {
    type: "vr_print_precision",
    message0: "set print precision to %1",
    args0: [dropdown("PRECISION", [["1", "0"], ["0.1", "1"], ["0.01", "2"], ["0.001", "3"], ["All Digits", "9"]])],
    colour: COLORS.looks,
    statement: true,
    python: (b) => `brain.set_print_precision(${field(b, "PRECISION")})\n`,
  },
  {
    type: "vr_print_color",
    message0: "set font color to %1",
    args0: [dropdown("COLOR", [["black", "BLACK"], ["red", "RED"], ["green", "GREEN"], ["blue", "BLUE"]])],
    colour: COLORS.looks,
    statement: true,
    python: (b) => `brain.set_print_color(${field(b, "COLOR")})\n`,
  },
  {
    type: "vr_pen_move",
    message0: "move pen %1",
    args0: [dropdown("ACTION", [["down", "DOWN"], ["up", "UP"]])],
    colour: COLORS.looks,
    statement: true,
    python: (b) => `pen.move(${field(b, "ACTION")})\n`,
  },
  {
    type: "vr_pen_color",
    message0: "set pen to color %1",
    args0: [dropdown("COLOR", [["black", "BLACK"], ["red", "RED"], ["green", "GREEN"], ["blue", "BLUE"]])],
    colour: COLORS.looks,
    statement: true,
    python: (b) => `pen.set_pen_color(${field(b, "COLOR")})\n`,
  },
  {
    type: "vr_pen_width",
    message0: "set pen width to %1",
    args0: [
      dropdown("WIDTH", [
        ["extra thin", "EXTRA_THIN"],
        ["thin", "THIN"],
        ["medium", "MEDIUM"],
        ["wide", "WIDE"],
        ["extra wide", "EXTRA_WIDE"],
      ]),
    ],
    colour: COLORS.looks,
    statement: true,
    python: (b) => `pen.set_pen_width(${field(b, "WIDTH")})\n`,
  },
  {
    type: "vr_pen_color_rgb",
    message0: "set pen color red %1 green %2 blue %3 opacity %4 %%",
    args0: [value("R", "Number"), value("G", "Number"), value("B", "Number"), value("A", "Number")],
    colour: COLORS.looks,
    statement: true,
    inputsInline: true,
    python: (b, g) =>
      `pen.set_pen_color_rgb(${num(b, g, "R")}, ${num(b, g, "G")}, ${num(b, g, "B")}, ${num(b, g, "A")})\n`,
  },
  {
    type: "vr_pen_fill",
    message0: "fill area with color red %1 green %2 blue %3 opacity %4 %%",
    args0: [value("R", "Number"), value("G", "Number"), value("B", "Number"), value("A", "Number")],
    colour: COLORS.looks,
    statement: true,
    inputsInline: true,
    python: (b, g) => `pen.fill(${num(b, g, "R")}, ${num(b, g, "G")}, ${num(b, g, "B")}, ${num(b, g, "A")})\n`,
  },

  // -------------------------------------------------------------- magnet
  {
    type: "vr_magnet",
    message0: "energize magnet to %1",
    args0: [dropdown("ACTION", [["boost", "BOOST"], ["drop", "DROP"]])],
    colour: COLORS.magnet,
    statement: true,
    python: (b) => `magnet.energize(${field(b, "ACTION")})\n`,
  },

  // -------------------------------------------------------------- events
  {
    type: "vr_when_started",
    message0: "when started",
    colour: COLORS.events,
    hat: true,
    python: (b, g) => {
      const { name, code } = hatFunction(b, g, "when_started");
      registrations.push(`vr_thread(${name})`);
      return code;
    },
  },
  {
    type: "vr_when_bumper",
    message0: "when %1 %2",
    args0: [dropdown("DEVICE", BUMPERS), dropdown("EVENT", [["pressed", "pressed"], ["released", "released"]])],
    colour: COLORS.events,
    hat: true,
    python: (b, g) => {
      const device = field(b, "DEVICE");
      const event = field(b, "EVENT");
      const { name, code } = hatFunction(b, g, `onevent_${device}_${event}`);
      registrations.push(`${device}.${event}(${name})`);
      return code;
    },
  },
  {
    type: "vr_when_eye",
    message0: "when %1 %2",
    args0: [
      dropdown("DEVICE", EYES),
      dropdown("EVENT", [["detects an object", "object_detected"], ["loses an object", "object_lost"]]),
    ],
    colour: COLORS.events,
    hat: true,
    python: (b, g) => {
      const device = field(b, "DEVICE");
      const event = field(b, "EVENT");
      const { name, code } = hatFunction(b, g, `onevent_${device}_${event}`);
      registrations.push(`${device}.${event}(${name})`);
      return code;
    },
  },
  {
    type: "vr_when_timer",
    message0: "when timer > %1 seconds",
    args0: [{ type: "field_number", name: "TIME", value: 1, min: 0 }],
    colour: COLORS.events,
    hat: true,
    python: (b, g) => {
      const { name, code } = hatFunction(b, g, "onevent_timer");
      registrations.push(`brain.timer_event(${name}, ${Math.round(Number(field(b, "TIME")) * 1000)})`);
      return code;
    },
  },
  {
    type: "vr_when_i_receive",
    message0: "when I receive %1",
    args0: [{ type: "field_input", name: "MESSAGE", text: "message1" }],
    colour: COLORS.events,
    hat: true,
    python: (b, g) => {
      const v = messageVar(field(b, "MESSAGE"));
      extraDefs.set(v, `${v} = Event()`);
      const { name, code } = hatFunction(b, g, `onevent_${v}`);
      registrations.push(`${v}(${name})`);
      return code;
    },
  },
  {
    type: "vr_broadcast",
    message0: "broadcast %1",
    args0: [{ type: "field_input", name: "MESSAGE", text: "message1" }],
    colour: COLORS.events,
    statement: true,
    python: (b) => {
      const v = messageVar(field(b, "MESSAGE"));
      extraDefs.set(v, `${v} = Event()`);
      return `${v}.broadcast()\n`;
    },
  },
  {
    type: "vr_broadcast_wait",
    message0: "broadcast %1 and wait",
    args0: [{ type: "field_input", name: "MESSAGE", text: "message1" }],
    colour: COLORS.events,
    statement: true,
    python: (b) => {
      const v = messageVar(field(b, "MESSAGE"));
      extraDefs.set(v, `${v} = Event()`);
      return `${v}.broadcast_and_wait()\n`;
    },
  },

  // ------------------------------------------------------------- control
  {
    type: "vr_wait",
    message0: "wait %1 seconds",
    args0: [value("TIME", "Number")],
    colour: COLORS.control,
    statement: true,
    python: (b, g) => `wait(${num(b, g, "TIME")}, SECONDS)\n`,
  },
  {
    type: "vr_repeat",
    message0: "repeat %1",
    args0: [value("TIMES", "Number")],
    message1: "%1",
    args1: [statements("DO")],
    colour: COLORS.control,
    statement: true,
    python: (b, g) => {
      const times = num(b, g, "TIMES");
      const count = /^\d+$/.test(times) ? times : `int(${times})`;
      return `for repeat_count in range(${count}):\n${body(b, g, "DO")}`;
    },
  },
  {
    type: "vr_forever",
    message0: "forever",
    message1: "%1",
    args1: [statements("DO")],
    colour: COLORS.control,
    cap: true,
    python: (b, g) => `while True:\n${body(b, g, "DO")}`,
  },
  {
    type: "vr_if",
    message0: "if %1 then",
    args0: [value("COND", "Boolean")],
    message1: "%1",
    args1: [statements("DO")],
    colour: COLORS.control,
    statement: true,
    python: (b, g) => `if ${bool(b, g, "COND")}:\n${body(b, g, "DO")}`,
  },
  {
    type: "vr_if_else",
    message0: "if %1 then",
    args0: [value("COND", "Boolean")],
    message1: "%1",
    args1: [statements("DO")],
    message2: "else %1",
    args2: [statements("ELSE")],
    colour: COLORS.control,
    statement: true,
    python: (b, g) => `if ${bool(b, g, "COND")}:\n${body(b, g, "DO")}else:\n${body(b, g, "ELSE")}`,
  },
  {
    type: "vr_wait_until",
    message0: "wait until %1",
    args0: [value("COND", "Boolean")],
    colour: COLORS.control,
    statement: true,
    python: (b, g) => `while not ${bool(b, g, "COND", Order.LOGICAL_NOT)}:\n${g.INDENT}wait(5, MSEC)\n`,
  },
  {
    type: "vr_repeat_until",
    message0: "repeat until %1",
    args0: [value("COND", "Boolean")],
    message1: "%1",
    args1: [statements("DO")],
    colour: COLORS.control,
    statement: true,
    python: (b, g) => `while not ${bool(b, g, "COND", Order.LOGICAL_NOT)}:\n${body(b, g, "DO")}`,
  },
  {
    type: "vr_while",
    message0: "while %1",
    args0: [value("COND", "Boolean")],
    message1: "%1",
    args1: [statements("DO")],
    colour: COLORS.control,
    statement: true,
    python: (b, g) => `while ${bool(b, g, "COND")}:\n${body(b, g, "DO")}`,
  },
  {
    type: "vr_break",
    message0: "break",
    colour: COLORS.control,
    cap: true,
    python: () => "break\n",
  },
  {
    type: "vr_stop_project",
    message0: "stop project",
    colour: COLORS.control,
    cap: true,
    python: () => "stop_project()\n",
  },

  // ------------------------------------------------------------- sensing
  {
    type: "vr_reset_timer",
    message0: "reset timer",
    colour: COLORS.sensing,
    statement: true,
    python: () => "brain.timer.reset()\n",
  },
  {
    type: "vr_timer",
    message0: "timer in seconds",
    colour: COLORS.sensing,
    output: "Number",
    python: () => ["brain.timer.time(SECONDS)", Order.FUNCTION_CALL],
  },
  {
    type: "vr_drive_is_done",
    message0: "drive is done?",
    colour: COLORS.sensing,
    output: "Boolean",
    python: () => ["drivetrain.is_done()", Order.FUNCTION_CALL],
  },
  {
    type: "vr_drive_is_moving",
    message0: "drive is moving?",
    colour: COLORS.sensing,
    output: "Boolean",
    python: () => ["drivetrain.is_moving()", Order.FUNCTION_CALL],
  },
  {
    type: "vr_drive_heading",
    message0: "drive heading in degrees",
    colour: COLORS.sensing,
    output: "Number",
    python: () => ["drivetrain.heading(DEGREES)", Order.FUNCTION_CALL],
  },
  {
    type: "vr_drive_rotation",
    message0: "drive rotation in degrees",
    colour: COLORS.sensing,
    output: "Number",
    python: () => ["drivetrain.rotation(DEGREES)", Order.FUNCTION_CALL],
  },
  {
    type: "vr_bumper_pressed",
    message0: "%1 pressed?",
    args0: [dropdown("DEVICE", BUMPERS)],
    colour: COLORS.sensing,
    output: "Boolean",
    python: (b) => [`${field(b, "DEVICE")}.pressed()`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_eye_near",
    message0: "%1 is near object?",
    args0: [dropdown("DEVICE", EYES)],
    colour: COLORS.sensing,
    output: "Boolean",
    python: (b) => [`${field(b, "DEVICE")}.near_object()`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_eye_detects",
    message0: "%1 detects %2 ?",
    args0: [dropdown("DEVICE", EYES), dropdown("COLOR", EYE_COLORS)],
    colour: COLORS.sensing,
    output: "Boolean",
    python: (b) => [`${field(b, "DEVICE")}.detect(${field(b, "COLOR")})`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_eye_brightness",
    message0: "%1 brightness in %%",
    args0: [dropdown("DEVICE", EYES)],
    colour: COLORS.sensing,
    output: "Number",
    python: (b) => [`${field(b, "DEVICE")}.brightness(PERCENT)`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_distance_found",
    message0: "%1 found an object?",
    args0: [dropdown("DEVICE", DISTANCES)],
    colour: COLORS.sensing,
    output: "Boolean",
    python: (b) => [`${field(b, "DEVICE")}.found_object()`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_distance",
    message0: "%1 distance in %2",
    args0: [dropdown("DEVICE", DISTANCES), dropdown("UNITS", [["mm", "MM"], ["inches", "INCHES"]])],
    colour: COLORS.sensing,
    output: "Number",
    python: (b) => [`${field(b, "DEVICE")}.get_distance(${field(b, "UNITS")})`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_position",
    message0: "position %1 in %2",
    args0: [dropdown("AXIS", [["X", "X"], ["Y", "Y"]]), dropdown("UNITS", [["mm", "MM"], ["inches", "INCHES"]])],
    colour: COLORS.sensing,
    output: "Number",
    python: (b) => [`location.position(${field(b, "AXIS")}, ${field(b, "UNITS")})`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_position_angle",
    message0: "position angle in degrees",
    colour: COLORS.sensing,
    output: "Number",
    python: () => ["location.position_angle(DEGREES)", Order.FUNCTION_CALL],
  },

  // --------------------------------------------------------------- lists
  {
    type: "vr_list_add",
    message0: "add %1 to %2",
    args0: [value("ITEM"), listField],
    colour: COLORS.lists,
    statement: true,
    inputsInline: true,
    python: (b, g) => `${list(b, g)}.append(${str(b, g, "ITEM")})\n`,
  },
  {
    type: "vr_list_delete",
    message0: "delete %1 of %2",
    args0: [value("INDEX", "Number"), listField],
    colour: COLORS.lists,
    statement: true,
    inputsInline: true,
    python: (b, g) => `del ${list(b, g)}[${index(b, g, "INDEX")}]\n`,
  },
  {
    type: "vr_list_clear",
    message0: "delete all of %1",
    args0: [listField],
    colour: COLORS.lists,
    statement: true,
    python: (b, g) => `${list(b, g)}.clear()\n`,
  },
  {
    type: "vr_list_insert",
    message0: "insert %1 at %2 of %3",
    args0: [value("ITEM"), value("INDEX", "Number"), listField],
    colour: COLORS.lists,
    statement: true,
    inputsInline: true,
    python: (b, g) => `${list(b, g)}.insert(${index(b, g, "INDEX")}, ${str(b, g, "ITEM")})\n`,
  },
  {
    type: "vr_list_replace",
    message0: "replace item %1 of %2 with %3",
    args0: [value("INDEX", "Number"), listField, value("ITEM")],
    colour: COLORS.lists,
    statement: true,
    inputsInline: true,
    python: (b, g) => `${list(b, g)}[${index(b, g, "INDEX")}] = ${str(b, g, "ITEM")}\n`,
  },
  {
    type: "vr_list_replace_2d",
    message0: "replace item row %1 column %2 of %3 with %4",
    args0: [value("ROW", "Number"), value("COL", "Number"), listField, value("ITEM")],
    colour: COLORS.lists,
    statement: true,
    inputsInline: true,
    python: (b, g) => `${list(b, g)}[${index(b, g, "ROW")}][${index(b, g, "COL")}] = ${str(b, g, "ITEM")}\n`,
  },
  {
    type: "vr_list_get",
    message0: "%1",
    args0: [listField],
    colour: COLORS.lists,
    output: "Array",
    python: (b, g) => [list(b, g), Order.ATOMIC],
  },
  {
    type: "vr_list_empty",
    message0: "empty list",
    colour: COLORS.lists,
    output: "Array",
    python: () => ["[]", Order.ATOMIC],
  },
  {
    type: "vr_list_item",
    message0: "item %1 of %2",
    args0: [value("INDEX", "Number"), listField],
    colour: COLORS.lists,
    output: null,
    inputsInline: true,
    python: (b, g) => [`${list(b, g)}[${index(b, g, "INDEX")}]`, Order.MEMBER],
  },
  {
    type: "vr_list_item_2d",
    message0: "item row %1 column %2 of %3",
    args0: [value("ROW", "Number"), value("COL", "Number"), listField],
    colour: COLORS.lists,
    output: null,
    inputsInline: true,
    python: (b, g) => [`${list(b, g)}[${index(b, g, "ROW")}][${index(b, g, "COL")}]`, Order.MEMBER],
  },
  {
    type: "vr_list_index_of",
    message0: "item # of %1 in %2",
    args0: [value("ITEM"), listField],
    colour: COLORS.lists,
    output: "Number",
    inputsInline: true,
    python: (b, g) => {
      const l = list(b, g);
      const item = str(b, g, "ITEM");
      return [`(${l}.index(${item}) + 1 if ${item} in ${l} else 0)`, Order.CONDITIONAL];
    },
  },
  {
    type: "vr_list_length",
    message0: "length of %1",
    args0: [listField],
    colour: COLORS.lists,
    output: "Number",
    python: (b, g) => [`len(${list(b, g)})`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_list_contains",
    message0: "%1 contains %2 ?",
    args0: [listField, value("ITEM")],
    colour: COLORS.lists,
    output: "Boolean",
    inputsInline: true,
    python: (b, g) => [`${str(b, g, "ITEM")} in ${list(b, g)}`, Order.RELATIONAL],
  },

  // ----------------------------------------------------------- operators
  {
    type: "vr_arith",
    message0: "%1 %2 %3",
    args0: [
      value("A", "Number"),
      dropdown("OP", [["+", "+"], ["-", "-"], ["*", "*"], ["/", "/"]]),
      value("B", "Number"),
    ],
    colour: COLORS.operators,
    output: "Number",
    inputsInline: true,
    python: (b, g) => {
      const op = field(b, "OP");
      const order = op === "+" || op === "-" ? Order.ADDITIVE : Order.MULTIPLICATIVE;
      return [`${num(b, g, "A", order)} ${op} ${num(b, g, "B", order)}`, order];
    },
  },
  {
    type: "vr_random",
    message0: "pick random %1 to %2",
    args0: [value("FROM", "Number"), value("TO", "Number")],
    colour: COLORS.operators,
    output: "Number",
    inputsInline: true,
    python: (b, g) => {
      extraDefs.set("import random", "import random");
      return [`random.randint(${num(b, g, "FROM")}, ${num(b, g, "TO")})`, Order.FUNCTION_CALL];
    },
  },
  {
    type: "vr_compare",
    message0: "%1 %2 %3",
    args0: [value("A"), dropdown("OP", [[">", ">"], ["<", "<"], ["=", "=="]]), value("B")],
    colour: COLORS.operators,
    output: "Boolean",
    inputsInline: true,
    python: (b, g) => [
      `${num(b, g, "A", Order.RELATIONAL)} ${field(b, "OP")} ${num(b, g, "B", Order.RELATIONAL)}`,
      Order.RELATIONAL,
    ],
  },
  {
    type: "vr_and_or",
    message0: "%1 %2 %3",
    args0: [value("A", "Boolean"), dropdown("OP", [["and", "and"], ["or", "or"]]), value("B", "Boolean")],
    colour: COLORS.operators,
    output: "Boolean",
    inputsInline: true,
    python: (b, g) => {
      const order = field(b, "OP") === "and" ? Order.LOGICAL_AND : Order.LOGICAL_OR;
      return [`${bool(b, g, "A", order)} ${field(b, "OP")} ${bool(b, g, "B", order)}`, order];
    },
  },
  {
    type: "vr_not",
    message0: "not %1",
    args0: [value("A", "Boolean")],
    colour: COLORS.operators,
    output: "Boolean",
    python: (b, g) => [`not ${bool(b, g, "A", Order.LOGICAL_NOT)}`, Order.LOGICAL_NOT],
  },
  {
    type: "vr_join",
    message0: "join %1 %2",
    args0: [value("A"), value("B")],
    colour: COLORS.operators,
    output: "String",
    inputsInline: true,
    python: (b, g) => [`str(${str(b, g, "A")}) + str(${str(b, g, "B")})`, Order.ADDITIVE],
  },
  {
    type: "vr_letter_of",
    message0: "letter %1 of %2",
    args0: [value("INDEX", "Number"), value("TEXT")],
    colour: COLORS.operators,
    output: "String",
    inputsInline: true,
    python: (b, g) => [`str(${str(b, g, "TEXT")})[int(${num(b, g, "INDEX")}) - 1]`, Order.MEMBER],
  },
  {
    type: "vr_length_of",
    message0: "length of %1",
    args0: [value("TEXT")],
    colour: COLORS.operators,
    output: "Number",
    python: (b, g) => [`len(str(${str(b, g, "TEXT")}))`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_contains",
    message0: "%1 contains %2 ?",
    args0: [value("TEXT"), value("PART")],
    colour: COLORS.operators,
    output: "Boolean",
    inputsInline: true,
    python: (b, g) => [`str(${str(b, g, "PART")}) in str(${str(b, g, "TEXT")})`, Order.RELATIONAL],
  },
  {
    type: "vr_mod",
    message0: "remainder of %1 / %2",
    args0: [value("A", "Number"), value("B", "Number")],
    colour: COLORS.operators,
    output: "Number",
    inputsInline: true,
    python: (b, g) => [
      `${num(b, g, "A", Order.MULTIPLICATIVE)} % ${num(b, g, "B", Order.MULTIPLICATIVE)}`,
      Order.MULTIPLICATIVE,
    ],
  },
  {
    type: "vr_round",
    message0: "round %1",
    args0: [value("A", "Number")],
    colour: COLORS.operators,
    output: "Number",
    python: (b, g) => [`round(${num(b, g, "A")})`, Order.FUNCTION_CALL],
  },
  {
    type: "vr_math_fn",
    message0: "%1 of %2",
    args0: [
      dropdown("FN", [
        ["abs", "abs"],
        ["floor", "floor"],
        ["ceiling", "ceil"],
        ["sqrt", "sqrt"],
        ["sin", "sin"],
        ["cos", "cos"],
        ["tan", "tan"],
        ["asin", "asin"],
        ["acos", "acos"],
        ["atan", "atan"],
        ["ln", "ln"],
        ["log", "log10"],
        ["e ^", "exp"],
        ["10 ^", "pow10"],
      ]),
      value("A", "Number"),
    ],
    colour: COLORS.operators,
    output: "Number",
    inputsInline: true,
    python: (b, g) => {
      const fn = field(b, "FN");
      const a = num(b, g, "A");
      if (fn === "abs") return [`abs(${a})`, Order.FUNCTION_CALL];
      extraDefs.set("import math", "import math");
      // Trig works in degrees, like Scratch and VEXcode.
      const code: Record<string, string> = {
        floor: `math.floor(${a})`,
        ceil: `math.ceil(${a})`,
        sqrt: `math.sqrt(${a})`,
        sin: `math.sin(math.radians(${a}))`,
        cos: `math.cos(math.radians(${a}))`,
        tan: `math.tan(math.radians(${a}))`,
        asin: `math.degrees(math.asin(${a}))`,
        acos: `math.degrees(math.acos(${a}))`,
        atan: `math.degrees(math.atan(${a}))`,
        ln: `math.log(${a})`,
        log10: `math.log10(${a})`,
        exp: `math.exp(${a})`,
        pow10: `math.pow(10, ${a})`,
      };
      return [code[fn], Order.FUNCTION_CALL];
    },
  },
];

let registered = false;

export function registerBlocks(generator: PythonGenerator) {
  if (registered) return;
  registered = true;
  Blockly.Extensions.register("vr_hat", function (this: Blockly.Block) {
    // Hats aren't steps themselves; don't highlight/step on them.
    this.suppressPrefixSuffix = true;
  });
  Blockly.common.defineBlocksWithJsonArray(
    SPECS.map((s) => {
      const json: Record<string, unknown> = {
        type: s.type,
        message0: s.message0,
        args0: s.args0 ?? [],
        colour: s.colour,
        tooltip: s.tooltip ?? "",
      };
      if (s.message1) Object.assign(json, { message1: s.message1, args1: s.args1 });
      if (s.message2) Object.assign(json, { message2: s.message2, args2: s.args2 });
      if (s.output !== undefined) json.output = s.output;
      if (s.statement) Object.assign(json, { previousStatement: null, nextStatement: null });
      if (s.cap) json.previousStatement = null;
      if (s.hat) Object.assign(json, { nextStatement: null, extensions: ["vr_hat"] });
      if (s.inputsInline) json.inputsInline = true;
      return json;
    }),
  );
  for (const s of SPECS) generator.forBlock[s.type] = s.python as never;
}

export const HAT_TYPES = new Set(SPECS.filter((s) => s.hat).map((s) => s.type));
