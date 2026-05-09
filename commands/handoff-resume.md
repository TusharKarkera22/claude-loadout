---
description: Resume a teammate's handoff — clone the bundle, review the summary + diff stat, then apply only after explicit user confirmation.
argument-hint: "<git-url-or-owner/repo-or-local-path> [--repo .] [--no-checkout] [--allow-dirty]"
---

You are helping the user pick up an in-progress handoff from a teammate. **Patch application happens only after the user explicitly says yes.**

The user passed: `$ARGUMENTS`

**Step 1 — Fetch the bundle to a stable local path.** Pick the first positional token from `$ARGUMENTS` as the source. If it looks like a local directory containing a `handoff.json`, use it directly. Otherwise clone it into a temp dir at `~/.claude-loadout/_handoff-staging/<short-id>/` (create the parent dir if missing). Use `git clone --depth 1` for a Git URL; expand `owner/repo` shorthand to `https://github.com/owner/repo.git`.

Print the local bundle path you ended up with so the user can see it.

**Step 2 — Run resume in review mode (no apply).** Forward the remaining flags from `$ARGUMENTS` (everything after the source) and add `--no-apply`. Use the local bundle path you just resolved as the source argument:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.cjs" handoff resume <local-bundle-path> --no-apply <remaining-flags>
```

The CLI validates the manifest, optionally checks out the author's branch, and prints a `git apply --stat` diff stat. Capture both stdout and stderr — the diff stat lands on stderr.

**Step 3 — Surface the summary + scope.** Read `<local-bundle-path>/handoff.md` and show it to the user. Then present the diff stat the CLI emitted. Together these answer: *what was the teammate doing, and how big is the patch I'm about to take?*

**Step 4 — Ask before applying.** Ask the user verbatim: *"Apply this patch to your working tree? (y/N)"*. **Do not apply unless they answer yes.** If they say no or hesitate, stop here and offer to discuss the changes first.

**Step 5 — Apply on confirmation.** If the user confirms, run the same command without `--no-apply` and with `--yes` (since the CLI is non-interactive in this context):

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.cjs" handoff resume <local-bundle-path> --yes <remaining-flags>
```

Surface the CLI's output (branch switched, patch applied), then propose the first concrete next task from the summary's "What's pending" / "What I'd do next" sections. Confirm with the user before starting work.
