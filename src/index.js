// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// index.js
// ---------------------------------------------------------------------------

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { extractExamples } from "./markdown.js";
import { cleanEnvironment, findNpmCli, runProcess } from "./process.js";

export { extractExamples } from "./markdown.js";

// PUBLIC
// ---------------------------------------------------------------------------

/** Run trusted README snippets against a registry package or local .tgz, not a checkout. */
export async function runTrial({
  packageSpec,
  readme = "README.md",
  only = [],
  timeout = 10000,
  installTimeout = 120000,
}) {
  if (!packageSpec || packageSpec.startsWith("-")) throw new Error("A package spec is required.");
  for (const value of [timeout, installTimeout]) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
      throw new Error("Timeouts must be positive integers up to 2147483647.");
    }
  }
  const examples = extractExamples(await readFile(readme, "utf8"));
  for (const name of only) {
    if (!examples.some((example) => example.name === name)) {
      throw new Error(`Unknown example '${name}'.`);
    }
  }
  const selected = only.length
    ? examples.filter((example) => only.includes(example.name))
    : examples;
  if (!selected.length)
    throw new Error("No marked examples found. Add <!-- readme-trial: name -->.");
  const spec = await resolvePackageSpec(packageSpec);
  const npmCli = findNpmCli();
  const root = await mkdtemp(join(tmpdir(), "readme-trial-"));
  try {
    const environment = cleanEnvironment();
    const userconfig = join(root, "user.npmrc");
    const globalconfig = join(root, "global.npmrc");
    await writeFile(userconfig, "");
    await writeFile(globalconfig, "");
    await writeFile(join(root, "package.json"), JSON.stringify({ private: true }));
    const install = await runProcess(
      process.execPath,
      [
        npmCli,
        "install",
        spec,
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
        "--omit=dev",
        "--userconfig",
        userconfig,
        "--globalconfig",
        globalconfig,
        "--cache",
        join(root, "cache"),
      ],
      { cwd: root, env: environment, timeout: installTimeout },
    );
    const report = { packageSpec, readme, ok: false, install, examples: [] };
    if (!install.ok) return report;
    for (const [index, example] of selected.entries()) {
      // Each example gets its own cwd, sharing only the installed package dependencies.
      const directory = join(root, "examples", String(index + 1));
      await mkdir(directory, { recursive: true });
      const extension = example.language === "cjs" ? "cjs" : "mjs";
      const file = join(directory, `example.${extension}`);
      await writeFile(file, example.code);
      const result = await runProcess(process.execPath, [file], {
        cwd: directory,
        env: environment,
        timeout,
      });
      report.examples.push({ name: example.name, line: example.line, ...result });
    }
    report.ok = report.examples.every((example) => example.ok);
    return report;
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

// PRIVATE
// ---------------------------------------------------------------------------

async function resolvePackageSpec(spec) {
  if (spec.endsWith(".tgz") && !spec.startsWith("https://")) {
    const path = resolve(spec.replace(/^file:/, ""));
    if (!(await stat(path)).isFile()) throw new Error("Package tarball must be a file.");
    return path;
  }
  if (spec.startsWith(".") || isAbsolute(spec) || spec.startsWith("file:")) {
    throw new Error("Pack local directories first: npm pack --ignore-scripts. Then pass the .tgz.");
  }
  if (!/^(@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*(@[a-z0-9.*^~<>=|+-]+)?$/i.test(spec)) {
    throw new Error("Use an npm package name with an optional version, or a local .tgz file.");
  }
  return spec;
}
