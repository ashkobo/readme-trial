// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// demo.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { extractExamples } from "@ashkobo/readme-trial";

const fence = String.fromCharCode(96).repeat(3);
const example = [
  "<!-- readme-trial: quick-start -->",
  `${fence}js`,
  "console.log(42);",
  fence,
].join("\n");
assert.equal(extractExamples(example)[0].name, "quick-start");
assert.throws(() => extractExamples(example.replace("quick-start", "bad/name")));
assert.throws(() => extractExamples(example.replace("console.log(42);", "")));
console.log("PASS valid README example; malformed markers and empty examples are rejected");
