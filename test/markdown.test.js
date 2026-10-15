// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// markdown.test.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import test from "node:test";
import { extractExamples } from "../src/markdown.js";

test("only opt-in fences run, with source lines and CRLF preserved", () => {
  const markdown = [
    "```js",
    "throw new Error('do not run');",
    "```",
    "",
    "<!-- readme-trial: hello -->",
    "",
    "```javascript",
    "console.log('hello');",
    "```",
  ].join("\r\n");
  assert.deepEqual(extractExamples(markdown), [
    {
      name: "hello",
      language: "javascript",
      line: 8,
      code: "console.log('hello');",
    },
  ]);
});

test("long and tilde fences can contain shorter backticks and marker-like text", () => {
  const markdown = [
    "<!-- readme-trial: fence -->",
    "````mjs",
    "```",
    "<!-- readme-trial: not-a-marker -->",
    "````",
    "",
    "<!-- readme-trial: commonjs -->",
    "~~~cjs",
    "module.exports = 1;",
    "~~~",
  ].join("\n");
  const examples = extractExamples(markdown);
  assert.equal(examples.length, 2);
  assert.equal(examples[0].code, "```\n<!-- readme-trial: not-a-marker -->");
  assert.equal(examples[1].language, "cjs");
});

test("invalid markers fail instead of silently skipping an intended check", () => {
  for (const markdown of [
    "<!-- readme-trial: lost -->",
    "<!-- readme-trial: prose -->\nNot a code fence",
    "<!-- readme-trial: bash -->\n```bash\necho nope\n```",
    "<!-- readme-trial: open -->\n```js\nconsole.log(1)",
    "<!-- readme-trial: a -->\n<!-- readme-trial: b -->",
    "<!-- readme-trial: same -->\n```js\n```\n<!-- readme-trial: same -->\n```js\n```",
  ])
    assert.throws(() => extractExamples(markdown));
});

test("malformed markers fail even when another example is valid", () => {
  const valid = "<!-- readme-trial: valid -->\n```js\nconsole.log(1);\n```\n";
  for (const marker of [
    "<!-- readme-trial: bad/name -->",
    "<!-- readme-trial: -->",
    "<!-- readme-trial: two words -->",
    "<!-- readme-trial: broken",
    "<!-- README-TRIAL: case -->",
  ]) {
    assert.throws(
      () => extractExamples(`${valid}${marker}\n\x60\x60\x60js\nthrow 1;\n\x60\x60\x60`),
      /Invalid readme-trial marker/,
    );
  }
});

test("empty or whitespace-only marked fences cannot pass as a check", () => {
  for (const body of ["", "\n", "   \n\t"]) {
    assert.throws(
      () => extractExamples(`<!-- readme-trial: empty -->\n\x60\x60\x60js\n${body}\n\x60\x60\x60`),
      /empty code fence/,
    );
  }
});
