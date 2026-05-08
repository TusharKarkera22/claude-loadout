---
description: Bundle the current Claude Code config into a shareable loadout (CLAUDE.md, skills, commands, sub-agents) with a sanitize pass for secrets.
argument-hint: "[--scope user|project] [--name <slug>] [--description <text>] [--author <handle>] [--out ./my-loadout]"
---

Run the `claude-loadout` export pipeline. Inform the user about each finding from the sanitize pass and confirm before writing the bundle.

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.cjs" export $ARGUMENTS
```
