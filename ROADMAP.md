# Roadmap

## v0.1 (current)

Scaffold and core profile pipeline. **Status: scaffold landed; module bodies pending.**

- [ ] **Module A — Export** (`src/modules/export/`): scan config, build bundle, write `profile.json`
- [ ] **Module B — Sanitize** (`src/modules/sanitize/`): secret/path scanner with interactive review
- [ ] **Module C — Install** (`src/modules/install/`): fetch, validate, namespaced merge
- [ ] **Module D — Manage** (`src/modules/manage/`): list / update / remove / show
- [ ] CLI arg parsing in `src/cli.ts` (zod-based)
- [ ] Config loader with sensible defaults when `claude-profiles.config.json` is absent
- [ ] Tests against the example profile in `examples/example-profile/`

## v0.2

These slot into documented extension points already present in v0.1:

- **Team handoff archive** — implement `src/hooks/session-end.ts`. Capture transcript summary + diffs + todo state on Stop hook; resume via `/profile handoff <id>`.
- **Slack notifications** — Stop hook posts session summary to a configured webhook.
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
