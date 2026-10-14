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
