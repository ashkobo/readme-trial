#!/usr/bin/env node

// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// cli.js
// ---------------------------------------------------------------------------

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { extractExamples, runTrial } from "./index.js";

const help = `readme-trial — test README examples against an npm package

Usage:
  readme-trial --package package@version [--readme README.md]
  readme-trial --package ./package.tgz [--only example-name]
  readme-trial --pack [--readme README.md]
  readme-trial --list [--readme README.md]

Options:
  --package SPEC         Registry package or local npm pack tarball
  --pack                 Pack the current directory and test its real tarball
  --readme FILE          README to read (default: README.md)
  --only NAME            Run one marked example (repeatable)
  --timeout MS           Per-example timeout (default: 10000)
  --install-timeout MS   Install timeout (default: 120000)
  --json FILE            Write a JSON report
  --list                 List examples without installing or running them
  --help                 Show this help

Mark JavaScript fences with <!-- readme-trial: example-name -->.
Runs trusted code on your machine. A temporary directory is not a security sandbox.
`;

try {
  const { values } = parseArgs({
    options: {
      package: { type: "string" },
      pack: { type: "boolean" },
      readme: { type: "string", default: "README.md" },
      only: { type: "string", multiple: true, default: [] },
      timeout: { type: "string", default: "10000" },
      "install-timeout": { type: "string", default: "120000" },
      json: { type: "string" },
      list: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(help);
  } else if (values.list) {
    const examples = extractExamples(await readFile(values.readme, "utf8"));
    for (const example of examples)
      console.log(`${example.name} (${values.readme}:${example.line})`);
    if (!examples.length) throw new Error("No marked examples found.");
  } else {
    const report = await runTrial({
      packageSpec: values.package,
      packDirectory: values.pack ? process.cwd() : undefined,
      readme: values.readme,
      only: values.only,
      timeout: positiveInteger(values.timeout, "timeout"),
      installTimeout: positiveInteger(values["install-timeout"], "install-timeout"),
    });
    if (values.json) await writeFile(values.json, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.install.ok ? "PASS" : "FAIL"} install ${report.packageSpec}`);
    if (!report.install.ok) printFailure(report.install);
    for (const example of report.examples) {
      console.log(
        `${example.ok ? "PASS" : "FAIL"} ${example.name} (${values.readme}:${example.line})`,
      );
      if (example.stdout) process.stdout.write(example.stdout);
      if (!example.ok) printFailure(example);
    }
    process.exitCode = report.ok ? 0 : 1;
  }
} catch (error) {
  console.error(`readme-trial: ${error.message}`);
  process.exitCode = 1;
}

function positiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > 2147483647) {
    throw new Error(`--${name} must be a positive integer up to 2147483647.`);
  }
  return number;
}

function printFailure(result) {
  if (result.timedOut) console.error("Timed out.");
  if (result.outputLimited) console.error("Output exceeded 1 MiB.");
  if (result.spawnError) console.error(result.spawnError);
  if (result.stderr) process.stderr.write(result.stderr);
}
