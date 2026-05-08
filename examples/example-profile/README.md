# example-profile

Reference layout for a published `claude-profiles` profile. Copy this structure when authoring your own.

```
example-profile/
├── profile.json          # Manifest (validated by src/manifest/schema.ts)
├── skills/
│   └── example-skill/SKILL.md
└── commands/
    └── example-command.md
```

## Fields in `profile.json`

| Field | Notes |
|---|---|
| `schemaVersion` | Currently `1`. Bumped on breaking manifest changes. |
| `name` | Short slug (`python-data-eng`, not `My Python Setup`). |
| `author.handle` | GitHub-style handle. Used for namespacing on install (`@<handle>/...`). |
| `version` | Semver. |
| `claudeCodeMinVersion` | Minimum Claude Code CLI version this profile targets. |
| `items[]` | Each entry: `type`, `path`, optional `description`. Hooks are declared but skipped on install in v0.1. |

## Publishing

```bash
git init && git add . && git commit -m "Initial profile"
gh repo create <handle>/<name> --public --source=. --push
```

Tag the repo with the GitHub topic `claude-code-profile` so it's discoverable once the v0.2 registry ships.
