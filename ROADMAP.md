# Roadmap

## v0.1 (current)

Scaffold and core profile pipeline. **Status: implementation complete; 55 tests passing.**

- [x] **Module A — Export** (`src/modules/export/`): scan config, build bundle, write `profile.json`
- [x] **Module B — Sanitize** (`src/modules/sanitize/`): secret/path scanner, allow/deny lists, redaction helper
- [x] **Module C — Install** (`src/modules/install/`): fetch via storage adapter, validate, namespaced install root, hook safety boundary
- [x] **Module D — Manage** (`src/modules/manage/`): list / update / remove / show with path-traversal guards
- [x] CLI arg parsing in `src/cli/` (zod-validated subcommands)
- [x] Config loader (`src/config/loader.ts`) with sensible defaults when `claude-loadout.config.json` is absent
- [x] Tests: vitest suite covering manifest schema, config, all four modules, CLI dispatcher

## v0.2 (current)

**Team handoff** ships in v0.2.0. **Status: 103 tests passing.**

- [x] **`handoff create`** — AI-drafted summary + binary-safe `git diff` of every uncommitted change (tracked, staged, untracked) bundled with a zod-validated `handoff.json` manifest. Sanitize runs automatically.
- [x] **`handoff resume <source>`** — fetch via Git URL / `owner/repo` shorthand / local path; validate manifest; refuse dirty trees by default; auto-checkout author's branch by default; apply via `git apply --3way` with a visible fallback warning when `baseCommit` is missing locally.
- [x] **`handoff push`** — implements `GitStorageAdapter.publish()` (was a stub in v0.1). init + commit + push to a remote.
- [x] Two new slash commands: `/claude-loadout:handoff-create` and `/claude-loadout:handoff-resume <source>`.

Deferred from earlier v0.2 plans, still on the menu for future versions:

- **SessionEnd auto-archive** — `src/hooks/session-end.ts` is still a stub. v0.2 capture is intentionally manual (user controls when and what is shared); auto-archive will land when there is concrete demand for it.
- **Slack/Discord notifications** — Stop hook posts session summary to a configured webhook.
- **Hook import with consent** — extend Module C to import `type: "hook"` items behind a per-install confirmation prompt.
- **Profile registry / discovery site** — small static site indexing the GitHub topic `claude-code-profile`.

## v0.3+

- **Profile versioning + pinning** — semver-aware install, `--major-only` flag, lockfile
- **Profile composition** — install multiple profiles, declare conflict-resolution rules
- **Profile diffing** — `/profile diff @jane/python-eng @alex/python-eng`
- **Profile templates** — `/profile init --template python-data-eng` scaffolds a starter

## v1.0

- **Cloud storage adapters** — S3StorageAdapter, NotionStorageAdapter, PostgresStorageAdapter implementing `StorageAdapter` from `src/adapters/storage.interface.ts`
- **Approval gates** — PreToolUse hook posting to Slack/Discord, waiting for emoji reaction
- **Peer review of agent plans** — async comment + vote workflow

---

## Extension points (where to plug in)

| Area | File | What to drop in |
|---|---|---|
| New storage backend | `src/adapters/<your>-storage.ts` | Implement `StorageAdapter`; register in `cli.ts` |
| New module | `src/modules/<your>/index.ts` | Add subcommand to `KNOWN` in `cli.ts` |
| New slash command | `commands/<your>.md` | Markdown frontmatter; dispatch to CLI |
| Lifecycle hook | `src/hooks/<event>.ts` | Wire up in `.claude-plugin/plugin.json` |
| Sanitize rule | `src/modules/sanitize/index.ts` | Add to `HIGH_CONFIDENCE_PATTERNS` |
