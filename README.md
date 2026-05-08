# claude-profiles

> Share your Claude Code setup like dotfiles.

A Claude Code plugin that bundles a developer's `CLAUDE.md`, skills, slash commands, and sub-agents into a portable profile any other Claude Code user can install with one command.

> **Status: v0.1 scaffold.** Module bodies are stubs with `TODO(v0.1)` markers. Plugin manifest, slash commands, schema, and storage adapter interface are in place; logic is intentionally unimplemented so contributors can land it module-by-module. See `ROADMAP.md` for what's deferred to v0.2+.

---

## Why

There is no standard way to package and share "this is how I use Claude Code." Devs end up emailing each other CLAUDE.md snippets or copy-pasting skill files. `claude-profiles` makes it as easy as installing a dotfiles repo:

```bash
/profile install jane/python-data-eng
```

Now Jane's skills, slash commands, and sub-agents are available in your Claude Code session — namespaced under `@jane/...` so nothing of yours is overwritten.

---

## Quickstart (post-implementation)

```bash
# 1. Install the plugin
/plugin install claude-profiles

# 2. Bundle your current setup
/profile export

# 3. Review the sanitize report, push the bundle to GitHub
cd my-profile && git push -u origin main

# 4. A teammate installs it
/profile install your-handle/your-profile

# 5. Manage installed profiles
/profile list
/profile update your-handle/your-profile
/profile remove your-handle/your-profile
```

---

## Slash commands shipped

| Command | What it does |
|---|---|
| `/profile export` | Bundle the current config into a shareable profile |
| `/profile sanitize <dir>` | Re-run the secret/path scan on an existing bundle |
| `/profile install <src>` | Install a profile from a Git source |
| `/profile list` | List installed profiles |
| `/profile update <alias>` | Pull the latest version of an installed profile |
| `/profile remove <alias>` | Uninstall |
| `/profile show <alias>` | Print manifest + items |

---

## Design principles

1. **Zero infra** — Git is the only required backend in v0.1.
2. **Non-destructive merge** — installed profiles are namespaced (`@author/skill-name`); your local items always win.
3. **Safety by default** — export runs a sanitize pass with high-confidence secret regexes before writing the bundle. Hooks (executable code) are explicitly NOT importable in v0.1.
4. **Convention over config** — `.claude-profiles/` for installed profiles, `profile.json` as the manifest, `claude-profiles.config.json` for overrides.
5. **Modular** — each module (export / sanitize / install / manage) is independently scoped. v0.2+ slots into documented extension points.

---

## Project layout

```
claude-profiles/
├── .claude-plugin/plugin.json        # Claude Code plugin manifest
├── claude-profiles.config.json.example
├── commands/                          # Slash commands (Markdown frontmatter)
├── src/
│   ├── manifest/                      # profile.json schema (zod) + validator
│   ├── adapters/                      # Storage adapter interface + GitStorageAdapter
│   ├── modules/                       # export, sanitize, install, manage
│   ├── hooks/                         # session-end stub (v0.2 handoff)
│   └── cli.ts                         # Subcommand dispatcher
├── examples/example-profile/          # Reference of a published profile
├── ROADMAP.md
└── README.md
```

---

## Safety model

`claude-profiles` distinguishes **declarative** items (skills, commands, agents, CLAUDE.md — Markdown that Claude reads) from **executable** items (hooks — shell scripts the harness runs).

- v0.1 imports declarative items only.
- Hook import is gated behind `install.allowHookImport: true` in your config and is **deferred to v0.2** with an explicit per-install consent step.
- The sanitize pass is best-effort, not a security guarantee. Always review your bundle before pushing.

---

## Contributing

The scaffold is intentionally minimal. Each module file has a `TODO(v0.1)` block describing what to implement. PRs that land one module at a time are welcome.

---

## License

MIT
