# Changelog

All notable changes will be documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_No changes yet._

## [0.2.1] — Next-steps guidance after every "create" command

### Changed
- **`claude-loadout export` now prints a Next steps block** showing the exact `git init && git push` sequence and the resulting `/claude-loadout:profile-install <handle>/<name>` URL teammates would run. Previously the success message was a single "Exported N items to ./dir" line and users had no signpost for what to do with the bundle.
- **`claude-loadout handoff create` prints Next steps** with the `handoff push --remote …` command and the matching `/claude-loadout:handoff-resume …` URL the teammate uses.
- **`claude-loadout handoff push` prints the share URL** verbatim with both the slash-command form and the terminal form, so the user can copy-paste either into their teammate's chat.

### Notes
- No CLI behavior changes; this release only adds informational stdout footers on success paths. Tests unchanged at 106/106.

## [0.2.0] — Team handoff

### Added
- **`handoff create`** captures the active session into a shareable bundle: AI-drafted `handoff.md` summary + a binary-safe `changes.patch` of every uncommitted change (tracked, staged, and untracked, captured via a throwaway `GIT_INDEX_FILE` so the live index is never touched) + a zod-validated `handoff.json` manifest. Sanitize runs automatically and blocks high-confidence secret findings unless `--allow-findings` is passed.
- **`handoff resume <source>`** fetches a bundle from a Git URL, `owner/repo` shorthand, or local path. Validates the manifest, refuses to clobber a dirty working tree (`--allow-dirty` to override), checks out the original author's branch by default (`--no-checkout` to stay), and applies the patch via `git apply --3way`. Falls back to plain `git apply` with a visible warning when `manifest.baseCommit` is not in the local history.
- **`handoff push <bundle> --remote <git-url>`** publishes a handoff bundle: `git init` if needed, commit with `--message`, push to the remote on `main`. Implements `GitStorageAdapter.publish()`, which was a stub in v0.1.
- **TTY-aware confirmation prompt on `handoff resume`.** When stdin and stderr are both TTYs and `--yes` is not passed, the CLI runs a readline `Apply this patch? [y/N]` prompt before invoking `git apply`. CI / non-interactive callers (slash commands, vitest) auto-apply unchanged.
- **`git apply --stat` diff stat preview on resume.** The patch's file-level summary (e.g. `work.ts | 2 +-`, `1 file changed, 1 insertion(+), 1 deletion(-)`) prints before the prompt — including under `--no-apply` — so the reviewer sees scope before deciding.
- **`--yes` / `-y` flag on `handoff resume`** to skip the confirmation prompt explicitly when running interactively but you want to bypass it.
- **Two-phase `/claude-loadout:handoff-create` slash command.** Phase 1: Claude drafts the summary, saves it to `${TMPDIR}/loadout-handoff-summary.md`, shows it to the user, and **stops**. Phase 2 fires only when the user replies `bundle` / `looks good` / `ship it`; the user can edit the file freely between phases, or reply `cancel` to drop the draft. Eliminates the v0.2-pre-review one-shot summary risk.
- **Review-then-apply `/claude-loadout:handoff-resume` slash command.** Fetches the bundle, runs `--no-apply` first to show summary + diff stat, asks the user verbatim before applying, then runs with `--yes` only on confirmation.
- **New schema** `src/manifest/handoff-schema.ts` with `HandoffManifestSchema`, `loadHandoffManifest()`. Schema is decoupled from the v0.1 `ProfileManifestSchema` because the lifecycle differs (handoffs are read-once, profiles are persistent).
- **`tests/helpers/git-fixture.ts`** for tests that need real git repos: builds a temp repo with N commit batches, optional uncommitted edits, optional remote, and optional bare-repo target.
- **CLI integration round-trip** test (`handoff create → push → resume`) lives in `tests/cli/run.test.ts`.

### Changed
- **`GitStorageAdapter.publish()`** is no longer a stub. v0.1 left it `throw new Error("not implemented")`; v0.2 implements init + add + commit + push, with safe fallbacks (default user identity, idempotent remote setup).
- **`tests/helpers/git-fixture.ts:makeBareRepo()`** initialises bare repos with `--initial-branch=main` so a clone after a `main` push checks out cleanly without a "remote HEAD refers to nonexistent ref" warning.

### Notes
- The session-end hook (`src/hooks/session-end.ts`) stays a stub. Auto-archive on every session is deferred to a later release; the v0.2 capture model is deliberately manual so users control when (and what) gets handed off.
- Test count: 67 → 106 (39 new across schema, capture, resume with branch-checkout / base-missing / dirty-tree / confirm-apply / diff-stat paths, publish, and the CLI round-trip).

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
