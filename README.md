# Claude Loadout

> **Share your Claude Code setup like dotfiles.**
>
> A Claude Code plugin that bundles your `CLAUDE.md`, skills, slash commands, and sub-agents into a portable **loadout** any other Claude Code user can install with one command.

[![status](https://img.shields.io/badge/status-v0.1-amber)](#status--roadmap) [![tests](https://img.shields.io/badge/tests-55%20passing-green)](#development) [![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

![Claude Loadout — one author publishes a loadout, many teammates adopt it](./docs/hero.png)

---

## The pitch

Every Claude Code user gradually shapes their workflow with a personal mix of CLAUDE.md rules, custom skills, slash commands, and sub-agents. Today there is no standard way to share that. Devs end up emailing snippets, screenshotting setups, or copy-pasting skill files into Slack.

**Claude Loadout** treats your config like a gamer's loadout: a complete equipped set of gear you can publish once and let any teammate adopt — without disturbing their own gear.

```bash
# Bundle your setup
claude-loadout export --name py-data-eng --description "Python + dbt + Snowflake setup"

# Push it to GitHub. A teammate then runs:
claude-loadout install jane/py-data-eng

# Their Claude now has @jane/snowflake-explain, @jane/dbt-debug, @jane/data-reviewer
# — namespaced under @jane so their own setup is untouched.
```

---

## How it works

![Claude Loadout pipeline — export → sanitize → git push → install → adopters](./docs/flowchart.png)

The pipeline is six stages, from author to adopters:

1. **Your Claude Code config** — `CLAUDE.md`, skills, commands, sub-agents.
2. **Export** — bundled into a directory with a validated `profile.json` manifest.
3. **Sanitize** — scans the bundle for secrets, absolute home paths, and `*_KEY=` style assignments.
4. **Git push** — the bundle becomes a public (or private) repo on GitHub / GitLab / anywhere with Git.
5. **Install** — anyone runs `claude-loadout install owner/repo` to fetch and validate it.
6. **Adopters** — the loadout's items appear under `@author/...` in their Claude Code session, namespaced so nothing of their own is overwritten.

On the adopter's disk, an installed loadout looks like this:

```
~/.claude-loadout/jane-py-data-eng/
   skills/snowflake-explain/SKILL.md
   commands/dbt-debug.md
   agents/data-reviewer.md
   CLAUDE.md
   profile.json    ← validated manifest
   .install.json   ← source, ref, install date
```

---

## Quickstart

```bash
# 1. Setup
git clone <this repo> && cd claude-loadout
npm install
npm run build

# 2. Bundle your current Claude Code config
node dist/cli.js export \
  --source . \
  --out  ./my-loadout \
  --name my-loadout \
  --description "Tushar's Azure data-eng workflow" \
  --author your-github-handle

# 3. (Optional) Re-scan an existing loadout for secrets
node dist/cli.js sanitize ./my-loadout

# 4. Push it
cd my-loadout && git init && git add . && git commit -m "Initial loadout" && \
  gh repo create your-handle/my-loadout --public --source=. --push

# 5. A teammate installs it
node dist/cli.js install your-handle/my-loadout

# 6. Manage installed loadouts
node dist/cli.js list
node dist/cli.js show   your-handle-my-loadout
node dist/cli.js update your-handle-my-loadout
node dist/cli.js remove your-handle-my-loadout
```

After `npm link` (or once published) the binary is exposed as `claude-loadout`, so the same flows become `claude-loadout export …`, `claude-loadout install …`, etc.

The same operations are exposed as `/loadout *` slash commands once the plugin is loaded into Claude Code.

---

## Subcommand reference

| Command | What it does |
|---|---|
| `claude-loadout export` | Scan `CLAUDE.md` + `.claude/{skills,commands,agents,hooks}/`, copy them into a loadout, write a validated `profile.json`. Refuses to clobber a non-empty output dir. |
| `claude-loadout sanitize <dir>` | Walk a loadout, flag AWS / GitHub / Anthropic / OpenAI keys + absolute home paths + `*_KEY=` style assignments. Exit code 2 if any high-severity findings. |
| `claude-loadout install <src>` | Resolve `owner/repo` shorthand or a full Git URL, validate the manifest, copy declared items into `.claude-loadout/<author>-<name>/`. Hooks are skipped unless `--allow-hook-import`. |
| `claude-loadout list` | Print installed loadouts with version, author, install date. |
| `claude-loadout show <alias>` | Pretty-print the manifest of an installed loadout. |
| `claude-loadout update <alias>` | Re-fetch the recorded source. Stages to `<alias>.update-staging` and atomic-swaps so a failed update never corrupts the existing install. |
| `claude-loadout remove <alias>` | Uninstall. Aliases are checked against path traversal — you cannot escape `profilesDir`. |

---

## Configuration

Drop a `claude-loadout.config.json` in your project root. Anything you omit falls back to defaults.

```json
{
  "export": {
    "outputDir": "./my-loadout",
    "include": {
      "claudeMd": true,
      "skills": true,
      "commands": true,
      "agents": true,
      "hooks": false
    }
  },
  "sanitize": {
    "allow": [],
    "deny": ["my-org\\.local", "internal\\.svc\\.cluster"],
    "redactAbsolutePaths": true,
    "redactEnvAssignments": true
  },
  "install": {
    "profilesDir": ".claude-loadout",
    "namespacePrefix": "@",
    "allowHookImport": false
  },
  "author": {
    "handle": "your-github-handle",
    "displayName": "Your Name"
  }
}
```

See `claude-loadout.config.json.example` for the full shape.

---

## Safety model

Claude Loadout splits a loadout's contents into two classes and treats them very differently:

| Class | Examples | Behavior on install |
|---|---|---|
| **Declarative** | `CLAUDE.md`, skills, slash commands, sub-agents | Copied into `.claude-loadout/<alias>/` and namespaced by directory. Imported `CLAUDE.md` is **never auto-merged** into yours — you opt in section by section. |
| **Executable** | Hooks (shell scripts the harness runs) | **Skipped by default.** Importing hostile shell from a stranger's repo is the obvious supply-chain risk; v0.1 forbids it. Override per-install with `--allow-hook-import`. v0.2 will add an explicit consent flow. |

The sanitize pass is **best-effort, not a security guarantee**. Always review your loadout before pushing. The high-confidence regex catalogue covers the easy footguns (AWS access keys, GitHub PATs, Anthropic / OpenAI API keys, `/Users/<you>/`, `MY_*_KEY=`); it does not catch every secret you might paste into a CLAUDE.md.

---

## Architecture

```
src/
├── manifest/
│   ├── schema.ts          ← zod schema for profile.json (single source of truth)
│   └── validator.ts
├── adapters/
│   ├── storage.interface.ts   ← StorageAdapter contract
│   └── git-storage.ts         ← Git-backed implementation (v0.1 default)
├── modules/
│   ├── export/index.ts        ← Module A — bundle current config
│   ├── sanitize/index.ts      ← Module B — secret/path scanner + applyRedactions
│   ├── install/index.ts       ← Module C — fetch, validate, namespaced install
│   └── manage/index.ts        ← Module D — list / show / update (atomic) / remove
├── config/
│   └── loader.ts              ← Per-project claude-loadout.config.json with defaults
├── cli/
│   ├── parse-args.ts          ← Zero-dep flag parser
│   ├── run.ts                 ← runCli(argv): Promise<number>
│   └── handlers/              ← One zod-validated handler per subcommand
├── hooks/
│   └── session-end.ts         ← Stub for v0.2 team-handoff
└── cli.ts                     ← Process entry point
```

**Extension points** (where v0.2+ work plugs in without core changes):

| You want to add… | Where | What to implement |
|---|---|---|
| New storage backend (S3, Notion, Postgres) | `src/adapters/<name>-storage.ts` | `StorageAdapter` interface |
| New sanitize rule | `src/modules/sanitize/index.ts` | Append to `HIGH_CONFIDENCE_PATTERNS` |
| New module (e.g. `diff`) | `src/modules/<name>/index.ts` + `src/cli/handlers/<name>.ts` | Add subcommand to `SUBCOMMANDS` in `cli/run.ts` |
| Lifecycle hook (e.g. team-handoff) | `src/hooks/<event>.ts` | Wire in `.claude-plugin/plugin.json` |

---

## Status & roadmap

**v0.1 (current) — shipped:** all four modules implemented, CLI dispatcher, config loader, vitest suite (55 tests, all green), production build via `tsc`.

**v0.2 (planned, designed):** team-handoff archive (Stop hook), Slack notifications, hook import with consent flow, GitHub-topic-based discovery site.

**v0.3+:** versioning + pinning, loadout composition, `claude-loadout diff`, starter templates.

**v1.0:** cloud storage adapters, approval gates, peer review.

Full backlog with extension points: [`ROADMAP.md`](./ROADMAP.md).

---

## Development

```bash
npm install
npm run typecheck     # tsc --noEmit on src/ + tests/
npm test              # vitest run — currently 55 tests across 8 files
npm run test:watch    # interactive
npm run build         # tsc -> dist/, produces dist/cli.js
```

Tests live under `tests/`, mirror the `src/` layout, and rely on a `LocalStorageAdapter` test fake (`tests/helpers/local-storage.ts`) so install / manage tests never touch the network.

---

## Contributing

PRs that extend modules, add storage adapters, or land v0.2 features against the documented extension points are very welcome. Please add a test (the suite is fast — under 300ms) and keep `npm run typecheck` green.

---

## License

[MIT](./LICENSE)
