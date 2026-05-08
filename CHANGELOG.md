# Changelog

All notable changes will be documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No changes yet._

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
