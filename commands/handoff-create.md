---
description: Create a team handoff bundle. AI drafts the summary first, you review and edit, then we bundle — never bundles before you confirm.
argument-hint: "[--out ./handoff-<date>] [--source .] [--author <handle>]"
---

You are helping the user prepare a handoff bundle for a teammate. **This runs in two phases. Do not bundle until the user explicitly confirms the draft.**

The user passed: `$ARGUMENTS`

## Phase 1 — Draft the summary, then stop

Look at this session: what was the user trying to accomplish, what did we establish, what's still open? Write a concise handoff to the file path **`${TMPDIR:-/tmp}/loadout-handoff-summary.md`** (use the Write tool). Use this exact structure — omit a section rather than padding it:

```
# What I was working on
<one paragraph: the active goal in plain language a teammate can read cold>

# What's done
- <completed work, name files/functions, one item per line>

# What's pending
- [ ] <next concrete step>
- [ ] <...>

# Files touched
<list paths with one-line descriptions of the change>

# Decisions / context
<non-obvious things: why we chose X, what didn't work, hidden constraints a teammate would otherwise miss>

# What I'd do next
<one paragraph: your suggested next move>
```

Be specific. Avoid generic phrasing like "improved the codebase" — name the file, the function, the change.

After writing the file, **show the user the full draft** (paste it back into the chat) and say verbatim:

> *"Draft saved to `${TMPDIR:-/tmp}/loadout-handoff-summary.md`. Edit it directly in your editor if anything needs sharpening — it's plain markdown. When you're ready, say **bundle** to package it (with the diff + manifest), or **cancel** to drop it."*

**Stop here. Do not run the CLI in this turn.** Wait for the user to reply with `bundle`, `cancel`, or feedback.

---

## Phase 2 — Bundle (only when the user confirms)

When the user's next turn replies with **bundle**, **looks good**, **ship it**, **go**, or any clear confirmation:

1. Re-read `${TMPDIR:-/tmp}/loadout-handoff-summary.md` — the user may have edited it.
2. Run the CLI:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/cli.cjs" handoff create \
     --summary "${TMPDIR:-/tmp}/loadout-handoff-summary.md" \
     --source "${PWD}" \
     $ARGUMENTS
   ```

   If `--out` was not in `$ARGUMENTS`, append `--out ./handoff-$(date +%Y%m%d-%H%M)` so the bundle lands in a dated directory.

3. Surface the CLI's stdout (bundle path, branch, baseCommit) and any sanitize findings printed to stderr. If high-severity findings appear, tell the user to review them and — if they're false positives — re-run with `--allow-findings` after editing the summary; if real, redact and re-bundle.
4. Suggest the next step: *"Push it with `claude-loadout handoff push <bundle> --remote <git-url>`, or share the directory directly via Slack/email."*

When the user instead replies with **cancel**, **drop it**, **never mind**, **no**, or similar:

1. Delete the draft: `rm -f "${TMPDIR:-/tmp}/loadout-handoff-summary.md"`.
2. Confirm: *"Cancelled. Nothing was bundled."*

If the user gives feedback like "make the pending list shorter" or "drop the decisions section," edit the file and **stop again at the same prompt** — `bundle` or `cancel`. Iterate as many times as they need; do not bundle until they say so.
