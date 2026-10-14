// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// markdown.js
// ---------------------------------------------------------------------------

/** Extracts opt-in examples; unmarked fences are never executed. */
export function extractExamples(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const examples = [];
  const names = new Set();
  let pending = null;
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      const close = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        if (fence.name) {
          examples.push({
            name: fence.name,
            language: fence.language,
            line: fence.line,
            code: fence.code.join("\n"),
          });
        }
        fence = null;
      } else {
        fence.code.push(line);
      }
      continue;
    }
    const marker = line.match(/^\s*<!--\s*readme-trial:\s*([\w-]+)\s*-->\s*$/);
    if (marker) {
      if (pending) throw new Error(`Example '${pending}' is missing a code fence.`);
      if (names.has(marker[1])) throw new Error(`Duplicate example name '${marker[1]}'.`);
      pending = marker[1];
      names.add(pending);
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})([^`~]*)$/);
    if (open) {
      const language = open[2].trim().toLowerCase();
      if (pending && !["js", "javascript", "mjs", "cjs"].includes(language)) {
        throw new Error(`Example '${pending}' needs a js, javascript, mjs or cjs fence.`);
      }
      fence = {
        name: pending,
        language,
        char: open[1][0],
        length: open[1].length,
        line: index + 2,
        code: [],
      };
      pending = null;
    } else if (pending && line.trim()) {
      throw new Error(`Example '${pending}' must be followed by a code fence.`);
    }
  }
  if (fence?.name) throw new Error(`Unclosed code fence for '${fence.name}'.`);
  if (pending) throw new Error(`Example '${pending}' is missing a code fence.`);
  return examples;
}
