import * as Blockly from "blockly/core";
import { pythonGenerator } from "blockly/python";
import { HAT_TYPES, extraDefs, registerBlocks, registrations, resetGeneratorState } from "./blocks/defs";

registerBlocks(pythonGenerator);
pythonGenerator.INDENT = "    ";

/**
 * Python for a blocks workspace, in VEXcode's shape: one function per hat,
 * then the lines that start them. Blocks not under a hat are ignored, like
 * in VEXcode. With `highlight`, each statement is preceded by a call that
 * highlights its block (used to run and step; hidden from the code viewer).
 */
export function generatePython(ws: Blockly.Workspace, highlight: boolean) {
  pythonGenerator.STATEMENT_PREFIX = highlight ? "_vr_highlight(%1)\n" : null;
  resetGeneratorState();
  pythonGenerator.init(ws);
  const parts: string[] = [];
  for (const block of ws.getTopBlocks(true)) {
    if (!block.isEnabled()) continue;
    const isProcedure = block.type.startsWith("procedures_def");
    if (!HAT_TYPES.has(block.type) && !isProcedure) continue;
    const code = pythonGenerator.blockToCode(block, true);
    if (typeof code === "string" && code) parts.push(code);
  }
  const defs = [...extraDefs.values()];
  const body = (defs.length ? defs.join("\n") + "\n\n" : "") + parts.join("\n");
  const code = pythonGenerator.finish(body).trim();
  return code + (registrations.length ? "\n\n" + registrations.join("\n") + "\n" : "\n");
}
