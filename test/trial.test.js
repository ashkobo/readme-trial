// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// trial.test.js
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { runTrial } from "../src/index.js";
import { cleanEnvironment, findNpmCli, runProcess } from "../src/process.js";

let root;
let tarball;
let readme;

before(async () => {
  root = await mkdtemp(join(tmpdir(), "readme-trial-fixture-"));
  const fixture = join(root, "package with spaces");
  await mkdir(fixture);
  await writeFile(
    join(fixture, "package.json"),
    JSON.stringify({
      name: "readme-trial-fixture",
      version: "1.0.0",
      type: "module",
      files: ["index.js", "index.cjs"],
      exports: {
        ".": { import: "./index.js", require: "./index.cjs" },
        "./missing": "./not-packed.js",
      },
      scripts: { postinstall: "node -e \"require('fs').writeFileSync('postinstall-ran','bad')\"" },
    }),
  );
  await writeFile(join(fixture, "index.js"), "export const answer = 42;\n");
  await writeFile(join(fixture, "index.cjs"), "exports.answer = 42;\n");
  await writeFile(join(fixture, "not-packed.js"), "export const answer = 0;\n");
  const packed = await runProcess(
    process.execPath,
    [findNpmCli(), "pack", "--json", "--ignore-scripts"],
    { cwd: fixture, env: cleanEnvironment(), timeout: 30000 },
  );
  assert.equal(packed.ok, true, packed.stderr);
  tarball = join(fixture, JSON.parse(packed.stdout)[0].filename);
  readme = join(root, "README.md");
  await writeFile(
    readme,
    [
      "```js",
      "throw new Error('unmarked');",
      "```",
      "<!-- readme-trial: esm -->",
      "```js",
      "import assert from 'node:assert/strict';",
      "import { answer } from 'readme-trial-fixture';",
      "import { existsSync, writeFileSync } from 'node:fs';",
      "assert.equal(answer, 42);",
      "assert.equal(existsSync('../../node_modules/readme-trial-fixture/postinstall-ran'), false);",
      "assert.equal(process.env.README_TRIAL_SECRET, undefined);",
      "writeFileSync('leftover.txt', 'must not reach the next example');",
      "console.log(answer);",
      "```",
      "<!-- readme-trial: cjs -->",
      "```cjs",
      "const assert = require('node:assert/strict');",
      "assert.equal(require('readme-trial-fixture').answer, 42);",
      "assert.equal(require('node:fs').existsSync('leftover.txt'), false);",
      "```",
      "<!-- readme-trial: missing-export -->",
      "```js",
      "import 'readme-trial-fixture/missing';",
      "```",
      "<!-- readme-trial: missing-dependency -->",
      "```js",
      "import '@biomejs/biome';",
      "```",
      "<!-- readme-trial: timeout -->",
      "```js",
      "setInterval(() => {}, 1000);",
      "```",
    ].join("\n"),
  );
});

after(async () => {
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

test("real npm tarball detects missing exports/dependencies and timeout", async () => {
  const saved = process.env.README_TRIAL_SECRET;
  process.env.README_TRIAL_SECRET = "must-not-be-inherited";
  try {
    const report = await runTrial({ packageSpec: tarball, readme, timeout: 1500 });
    assert.equal(report.install.ok, true, report.install.stderr);
    assert.equal(report.ok, false);
    assert.deepEqual(
      report.examples.map(({ name, ok }) => [name, ok]),
      [
        ["esm", true],
        ["cjs", true],
        ["missing-export", false],
        ["missing-dependency", false],
        ["timeout", false],
      ],
    );
    assert.match(report.examples[2].stderr, /ERR_MODULE_NOT_FOUND/);
    assert.match(report.examples[3].stderr, /ERR_MODULE_NOT_FOUND/);
    assert.equal(report.examples[4].timedOut, true);
    assert.equal(report.examples[0].stdout.trim(), "42");
  } finally {
    if (saved === undefined) delete process.env.README_TRIAL_SECRET;
    else process.env.README_TRIAL_SECRET = saved;
  }
});

test("CLI runs a selected example and writes a machine-readable report", async () => {
  const json = join(root, "report.json");
  const result = await runProcess(
    process.execPath,
    [
      resolve("src/cli.js"),
      "--package",
      tarball,
      "--readme",
      readme,
      "--only",
      "esm",
      "--json",
      json,
    ],
    { cwd: process.cwd(), env: cleanEnvironment(), timeout: 30000 },
  );
  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /PASS esm/);
  const report = JSON.parse(await readFile(json, "utf8"));
  assert.equal(report.ok, true);
  assert.equal(report.examples.length, 1);
});

test("CLI propagates example failure as exit code 1", async () => {
  const result = await runProcess(
    process.execPath,
    [resolve("src/cli.js"), "--package", tarball, "--readme", readme, "--only", "missing-export"],
    { cwd: process.cwd(), env: cleanEnvironment(), timeout: 30000 },
  );
  assert.equal(result.exitCode, 1);
  assert.match(result.stdout, /FAIL missing-export/);
});

test("selection errors and missing markers fail before installing", async () => {
  await assert.rejects(runTrial({ packageSpec: tarball, readme, only: ["unknown"] }), /Unknown/);
  await assert.rejects(runTrial({ packageSpec: tarball, readme, timeout: 0 }), /Timeouts/);
  await assert.rejects(runTrial({ packageSpec: ".", readme }), /Pack local directories/);
  const unmarked = join(root, "unmarked.md");
  await writeFile(unmarked, "```js\nconsole.log(1);\n```\n");
  await assert.rejects(runTrial({ packageSpec: tarball, readme: unmarked }), /No marked/);
});

test("an invalid package archive reports an install failure without running examples", async () => {
  const corrupt = join(root, "corrupt.tgz");
  await writeFile(corrupt, "not an npm package");
  const report = await runTrial({ packageSpec: corrupt, readme });
  assert.equal(report.ok, false);
  assert.equal(report.install.ok, false);
  assert.deepEqual(report.examples, []);
});
