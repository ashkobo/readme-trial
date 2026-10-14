// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// process.test.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import test from "node:test";
import { cleanEnvironment, runProcess } from "../src/process.js";

test("output floods are bounded and fail the process", async () => {
  const result = await runProcess(
    process.execPath,
    ["-e", "while (true) process.stdout.write('x'.repeat(65536));"],
    { cwd: process.cwd(), env: cleanEnvironment(), timeout: 10000 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.outputLimited, true);
  assert.ok(result.stdout.length + result.stderr.length <= 1024 * 1024);
});

test("spawn errors are returned as failures", async () => {
  const result = await runProcess("readme-trial-nonexistent-command", [], {
    cwd: process.cwd(),
    env: cleanEnvironment(),
    timeout: 1000,
  });
  assert.equal(result.ok, false);
  assert.match(result.spawnError, /ENOENT/);
});
