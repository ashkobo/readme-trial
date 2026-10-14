// (c) 2026 Ash
// SPDX-License-Identifier: MIT
// process.js
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";

// PUBLIC
// ---------------------------------------------------------------------------

export function findNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
  ];
  for (const directory of (process.env.PATH ?? process.env.Path ?? "").split(delimiter)) {
    const binary = join(directory, process.platform === "win32" ? "npm.cmd" : "npm");
    if (existsSync(binary)) {
      candidates.push(realpathSync(binary));
      candidates.push(join(directory, "node_modules/npm/bin/npm-cli.js"));
    }
  }
  const cli = candidates.find((file) => file?.endsWith("npm-cli.js") && existsSync(file));
  if (!cli) throw new Error("Cannot locate npm-cli.js. Install Node.js with npm.");
  return cli;
}

/** Preserve OS essentials without passing project tokens or Node preload settings. */
export function cleanEnvironment() {
  const allowed = new Set([
    "path",
    "systemroot",
    "windir",
    "comspec",
    "pathext",
    "temp",
    "tmp",
    "tmpdir",
    "home",
    "userprofile",
    "localappdata",
    "appdata",
    "systemdrive",
    "programfiles",
    "programfiles(x86)",
    "lang",
    "lc_all",
    "ci",
    "term",
  ]);
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => allowed.has(key.toLowerCase())),
  );
}

/** Bound runtime and captured output, and terminate the child process tree on timeout. */
export function runProcess(command, args, { cwd, env, timeout }) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputLimited = false;
    let spawnError = null;
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stop = () => {
      if (process.platform === "win32") {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
        killer.on("error", () => child.kill());
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeout);
    const capture = (chunk, stream) => {
      if (outputLimited) return;
      const value = chunk.toString();
      if (stream === "stdout") stdout += value;
      else stderr += value;
      if (stdout.length + stderr.length > 1024 * 1024 && !outputLimited) {
        outputLimited = true;
        stdout = stdout.slice(0, 512 * 1024);
        stderr = stderr.slice(0, 512 * 1024);
        stop();
      }
    };
    child.stdout.on("data", (chunk) => capture(chunk, "stdout"));
    child.stderr.on("data", (chunk) => capture(chunk, "stderr"));
    child.on("error", (error) => {
      spawnError = error.message;
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        outputLimited,
        spawnError,
        durationMs: Date.now() - started,
        ok: exitCode === 0 && !timedOut && !outputLimited && !spawnError,
      });
    });
  });
}
