---
description: Bundle the current Claude Code config into a shareable profile (CLAUDE.md, skills, commands, sub-agents) with a sanitize pass for secrets.
argument-hint: "[--output ./my-profile] [--git-init] [--skip-sanitize]"
---

Run the `claude-loadout` export pipeline. Inform the user about each finding from the sanitize pass and confirm before writing the bundle.

```bash
npx tsx src/cli.ts export $ARGUMENTS
```
