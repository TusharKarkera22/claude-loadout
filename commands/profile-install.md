---
description: Install a Claude Code profile from a Git URL or owner/repo shorthand. Imports skills/commands/agents under a namespaced alias without overwriting local items.
argument-hint: "<owner/repo | git-url> [--ref <branch-or-tag>] [--as <alias>] [--yes]"
---

```bash
npx tsx src/cli.ts install $ARGUMENTS
```

Confirm what is being added before writing files. Refuse to import items of type `hook` unless the user has set `install.allowHookImport: true` in `claude-loadout.config.json`.
