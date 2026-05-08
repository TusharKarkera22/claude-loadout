# Changelog

All notable changes will be documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No changes yet._

## [0.1.3] — Provenance annotation for plugin-derived items

### Added
- **Each manifest item now carries a `provenance` field** when the export discovers it. `{ source: "user" }` for items you authored, `{ source: "plugin", marketplace: "<m>", plugin: "<p>" }` for items installed by another Claude Code plugin. Backward-compatible — `provenance` is optional, old manifests still validate.
- **`detectPluginProvenance(claudeRoot)`** scans `~/.claude/plugins/marketplaces/*/{plugins,external_plugins}/*/skills/*` and returns a map of skill name → source plugin. Called automatically by the CLI under `--scope user`.
- **New `ExportResult` fields** `userAuthoredCount` and `pluginDerivedCount` so callers can summarize what's in a bundle without re-walking it.

### Changed
- **`--scope user` CLI message reframed.** Replaces the v0.1.1 "review before publishing" warning with a useful breakdown:
  ```
  fyi: 0 user-authored + 134 plugin-derived item(s).
  Sharing this loadout will give recipients your full lineup, including these plugins:
    3d-web-experience, brainstorming, frontend-design, …
  Recipients see the source of each item via 'claude-loadout show <alias>'.
  ```
- **No filtering by default.** A bundle that's mostly plugin-derived is a feature, not a problem — the whole point is "use my setup, including the plugins I rely on." The annotation just makes it explicit instead of hidden.

### Notes
- Provenance detection is best-effort: it matches by skill directory name. Two plugins shipping the same skill name will both map to the first one indexed. Good enough for the v0.1.3 "fyi" annotation; deterministic ordering can come later.
- `claude-loadout show <alias>` automatically displays the new field because it pretty-prints the full manifest.

## [0.1.2] — Self-contained runtime bundle

### Fixed
- **Slash commands actually run after `/plugin install`** (no, really this time). v0.1.1 committed `dist/` so `node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js"` would find the entrypoint — but the entrypoint imports `zod`, `fast-glob`, and `simple-git`, and Claude Code's plugin install does a `git clone` without running `npm install`. Result: every command failed with `ERR_MODULE_NOT_FOUND` on first import. v0.1.2 ships a single self-contained CJS bundle at `bin/cli.cjs` (esbuild, all deps inlined, ~508 KB) that runs with zero `node_modules` access. Slash commands now invoke `node "${CLAUDE_PLUGIN_ROOT}/bin/cli.cjs"`.

### Changed
- `npm run build` now runs `tsc` (for `.d.ts` and typecheck) **and** `npm run bundle` (esbuild → `bin/cli.cjs`).
- `dist/` is back to being gitignored — it's local-only typecheck output, not the runtime artifact.
- CI gained a freshness check on `bin/` and a "runs outside the repo" smoke test that copies the bundle to `$RUNNER_TEMP` and confirms it boots without `node_modules`.

## [0.1.1] — Slash commands work after install + user-scope export

### Fixed
- **Slash commands now work for users who installed via `/plugin install`.** Previously every command body called `npx tsx src/cli.ts …`, which only worked inside the project's source tree. Real users who installed via marketplace had no `src/cli.ts` on disk, so every slash command failed silently. Commands now invoke `node "${CLAUDE_PLUGIN_ROOT}/dist/cli.js"` — Claude Code injects `CLAUDE_PLUGIN_ROOT` to point at the plugin install path, and the compiled CLI ships with the bundle.
- `dist/` is now committed to the repo because it is the runtime artifact every installed plugin needs. CI guards against drift via `git diff --exit-code dist/` after `npm run build`.

### Added
- `--scope user|project` flag on `claude-loadout export`. Default `project` keeps the existing behavior (looks under `<source>/.claude/skills/` etc.). New `user` scope walks `<source>/skills/` directly — the layout of `~/.claude/`. When `--scope user` is set without `--source`, the source defaults to `~/.claude/`.
- A stderr warning when `--scope user` runs, reminding the user that everything in `~/.claude/skills/` may include items installed by other plugins. Manual review before publishing remains required.

### Notes
Found by dogfooding the v0.1.0 release: invoking `/claude-loadout:profile-export` from a real Claude Code session surfaced both bugs at once.

## [0.1.0] — Initial release

### Added
- **Module A — Export.** Scans a project's `CLAUDE.md` and `.claude/{skills,commands,agents,hooks}/` directories, copies items into a bundle, writes a validated `profile.json`. Refuses to clobber a non-empty output directory.
- **Module B — Sanitize.** Walks a bundle and flags AWS access keys, GitHub PATs, Anthropic and OpenAI API keys, absolute home paths (`/Users/<name>/`, `/home/<name>/`), and `*_KEY=` / `*_TOKEN=` / `*_SECRET=` style assignments. Supports per-bundle allow / deny lists. Includes an `applyRedactions` helper that rewrites end-to-start so earlier offsets stay stable.
- **Module C — Install.** Fetches via a pluggable `StorageAdapter` (Git-backed by default), validates the manifest, enforces `claudeCodeMinVersion`, partitions hook items behind `allowHookImport`, copies only the manifest's declared paths (no partial installs), writes `.install.json` metadata for later management.
- **Module D — Manage.** `list` / `show` / `update` / `remove` against the install root. `update` stages to `<alias>.update-staging` and atomic-swaps so a failed update never corrupts an existing install. All path operations are guarded against alias-based traversal escapes.
- **CLI dispatcher.** Zero-dep flag parser, zod-validated subcommand handlers (`export`, `sanitize`, `install`, `list`, `show`, `update`, `remove`), exposed as the `claude-loadout` binary.
- **Config loader.** Per-project `claude-loadout.config.json` with sensible defaults applied via zod when the file is absent.
- **Plugin scaffolding.** `.claude-plugin/plugin.json`, slash commands as Markdown, an example loadout under `examples/example-profile/`.
- **Test suite.** 55 vitest tests across manifest schema, config, all four modules, and the CLI dispatcher. Runs in well under a second.
- **CI.** GitHub Actions workflow runs typecheck + tests + build on Node 20 and 22 for every push and pull request.
