# Maintaining readme-trial

The supported workflow is trusted, self-contained JS/CJS examples against a public npm
package or local tarball. TypeScript, shell, private registries and extra example dependencies
are outside the current scope. Keep runtime dependencies at zero unless a concrete case
justifies changing that choice.

## Before a release

1. Run `npm ci --ignore-scripts`, `npm run lint`, `npm test` and `npm run verify:package`.
2. From a consumer package, build it as usual, then run `node /path/to/readme-trial/src/cli.js --pack`.
   Check both a good example and an example importing a file omitted by `files`.
3. Confirm that malformed markers, empty examples, missing dependencies and timeouts fail.
   A passing process with an incorrect printed value needs an assertion in the README.
4. Run `npm pack --ignore-scripts --dry-run` and inspect the file list. Do not ship test caches,
   credentials or local reports. Confirm the installed executable, not just the source API.
5. Confirm the Node 22/24 and Windows/Linux/macOS CI jobs on the candidate commit. Update the
   version, changelog and unreleased install instructions before the first public release.

Packing and installation disable lifecycle scripts. A package that needs a build must be
built before the check. `--pack` does not run that build or leave an archive in the consumer.

## Review changes

Review Node/npm compatibility before changing the minimum version. For a bug report, request
the tool version, Node/npm version, platform, a small marked README and a package or tarball
that reproduces it. Ask users to remove private code and secrets from reports.

The useful release signal is an actual consumer detecting a stale import or distribution
error. More passing examples alone do not establish external demand.

## Troubleshooting

An invalid marker names its source line. Names accept ASCII letters, digits, underscores
and hyphens; a marker must precede a supported fence. Empty fences fail. A missing module
usually means the README imports a file or dependency absent from the packed package.
`--list` checks extraction without installing anything; `--only NAME` narrows an execution.
Use `--json FILE` for process details, and review output before sharing it.
