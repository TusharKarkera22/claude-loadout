# Contributing to Claude Loadout

Thanks for picking this up. The repo is small on purpose — every PR should keep it that way.

## Quick start

```bash
git clone <your fork>
cd claude-loadout
npm install
npm run typecheck     # tsc --noEmit, src + tests
npm test              # vitest, currently 55 tests
npm run build         # produces dist/cli.js
```

The full suite runs in well under a second. Please keep it that way.

## Where to add things

| You want to… | Edit |
|---|---|
| Add a new sanitize rule | `src/modules/sanitize/index.ts` — append to `HIGH_CONFIDENCE_PATTERNS` |
| Add a new storage backend (S3, Notion, …) | `src/adapters/<your>-storage.ts` — implement `StorageAdapter` |
| Add a new subcommand | `src/cli/handlers/<name>.ts` + register in `SUBCOMMANDS` in `src/cli/run.ts` |
| Add a lifecycle hook | `src/hooks/<event>.ts` and wire in `.claude-plugin/plugin.json` |
| Extend the bundle manifest | `src/manifest/schema.ts` — bump `schemaVersion` if it's a breaking change |

`ROADMAP.md` lists what's already designed for v0.2+ — feel free to land any of it.

## House rules

1. **Tests first.** Every behavior change ships with a failing test that goes green in the same commit. Reviewers will look for it. Test files live next to their subject under `tests/` mirroring the `src/` layout.
2. **Keep `npm run typecheck` green.** `strict` and `noUncheckedIndexedAccess` are on.
3. **No new runtime dependencies without a paragraph in the PR description** explaining why the standard library or an existing dep can't do it.
4. **Don't break the safety boundary.** The "declarative items vs executable hooks" split in `installProfile` is load-bearing. If your change weakens it, say so explicitly in the PR description and expect pushback.
5. **No emoji in source code or commit messages** unless the file already uses them.
6. **Conventional commits encouraged but not enforced** — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Squash-merge is the default.

## Reporting bugs

Use the issue template. Always include:
- `node --version`
- The exact command you ran
- The full error (stderr, no truncation)
- A minimal repro if you can manage one

## Reporting security issues

See [`SECURITY.md`](./SECURITY.md). Don't file public issues for vulnerabilities.

## Code of conduct

Be kind, be specific, be patient. Disagreement about technical decisions is welcome; personal attacks are not. Repeated violations get blocked from the repo without further warning.
