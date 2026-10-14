# readme-trial

**Your tests pass. Can a new user run your README?**

Test marked JavaScript examples against an npm package in a fresh directory.
Catch missing published files, stale imports, and dependencies that only exist on your machine.

```text
PASS install your-package@1.2.3
PASS quick-start (README.md:24)
FAIL advanced (README.md:48)
Error [ERR_MODULE_NOT_FOUND]: Cannot find module ...
```

## How it works

1. Read only the JavaScript fences you explicitly mark.
2. Install the registry package or an `npm pack` tarball into a temporary directory.
3. Run each example with Node.js, outside your checkout and its `node_modules`.
4. Return a failing exit code if installation or any example fails. Remove temporary files.

No runtime dependencies. No AI API. Node.js 22 or later and npm required.

## Quick start

This project is not published yet. From a local checkout:

```sh
node src/cli.js --package your-package@1.2.3 --readme ../your-package/README.md
```

In the package's README, place a marker directly before an existing example:

````markdown
<!-- readme-trial: quick-start -->
```js
import assert from "node:assert/strict";
import { greet } from "your-package";

assert.equal(greet("Ada"), "Hello, Ada!");
```
````

An exception or a nonzero exit code fails the example. Add assertions when you need to verify
results: printing a wrong value without throwing still passes.

Use `js`, `javascript` or `mjs` for ES modules; use `cjs` for CommonJS.
Unmarked code fences are left alone. Example names must be unique letters, numbers,
underscores or hyphens. Keep examples self-contained; each runs in its own working directory.

## Before publishing

Pack the built package first, then test what users will actually receive:

```sh
# In your package directory, after its normal build step:
npm pack --ignore-scripts

# From the readme-trial checkout:
node src/cli.js --package ../your-package/your-package-1.2.3.tgz \
  --readme ../your-package/README.md --json trial-report.json
```

Directories are deliberately rejected: installing a directory can create a link back to the
checkout, hiding missing files in the published package. The examples come from the README
you select, not automatically from the installed package.

## Options

| Option | Purpose |
| --- | --- |
| `--package SPEC` | Public registry name with optional version/tag, or a local `.tgz` |
| `--readme FILE` | README path; default `README.md` |
| `--only NAME` | Select a marked example; repeat to select more |
| `--list` | List example names and source lines without executing anything |
| `--timeout MS` | Per-example timeout; default 10,000 ms |
| `--install-timeout MS` | Install timeout; default 120,000 ms |
| `--json FILE` | Save install and example results, including stdout/stderr |

Exit code: `0` for success, `1` for a failed example, installation, or invalid input.
No marked examples is an error, so an accidentally empty check cannot turn green.

## GitHub Actions

While the tool is unpublished, pin a reviewed commit of this repository:

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
  # Run your project's normal install/build steps here.
  - uses: actions/checkout@v4
    with:
      repository: ashkobo/readme-trial
      ref: <reviewed-commit-sha>
      path: .readme-trial
  - run: npm pack --ignore-scripts
  - run: >-
      node .readme-trial/src/cli.js --package ./your-package-1.2.3.tgz
      --readme README.md --json trial-report.json
```

The repository and package are being prepared locally; the checkout example will become
usable after the first public release. The project's own CI tests Windows, macOS and Linux
on Node.js 22 and 24, then tests this README against its packed API.

## API

The following example is also this project's packaged-API smoke test.

<!-- readme-trial: extract-examples -->
```js
import assert from "node:assert/strict";
import { extractExamples } from "@ashkobo/readme-trial";

const markdown = [
  "<!-- readme-trial: hello -->",
  "```js",
  'console.log("hello");',
  "```",
].join("\n");

const [example] = extractExamples(markdown);
assert.equal(example.name, "hello");
assert.equal(example.code, 'console.log("hello");');
console.log("README extraction works from the installed package.");
```

`runTrial({ packageSpec, readme, only, timeout, installTimeout })` returns a report with
`ok`, `install`, and `examples`. Each process result includes its exit code, duration,
stdout, stderr, timeout status, and output-limit status. Invalid inputs throw; install or
example failures are returned in the report.

## Execution boundaries

Run only READMEs and packages you trust. A fresh directory prevents accidental use of
your checkout's dependencies; **it is not a security sandbox**. Executed code still has
your operating-system permissions and network access. Use a disposable CI runner for
untrusted code and avoid exposing credentials to that runner.

Install lifecycle scripts are disabled. Packages needing `postinstall` setup or native
compilation may fail. Private registries, extra example dependencies, TypeScript,
shell examples and browser examples are not supported in this first version.

The runner does not forward project environment variables, npm user/global configuration,
or Node preload options. It preserves essential OS environment variables. This does not
prevent executed code from reading files on your machine. Captured output is limited to
1 MiB per process. Each example has a separate cwd but shares the installed package tree;
this is not a pristine installation for every example. JSON reports can contain anything
printed by examples; review them before sharing.

## Development

```sh
npm ci --ignore-scripts
npm run lint
npm test
```

Tests use real locally packed npm fixtures, including missing exports, missing dependencies,
CommonJS, disabled install scripts, CLI exit codes and timeouts. No registry download is
needed for the fixture tests.

MIT · [Ash](https://github.com/ashkobo)
