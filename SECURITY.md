# Security policy

`claude-loadout` distributes user-authored configuration that other developers install on their machines. We take that responsibility seriously.

## Supported versions

The latest released `0.x` line gets security fixes. Pre-1.0 there is no extended support window for older minor versions — please upgrade.

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Use one of:

1. **GitHub private vulnerability disclosure** — `Security` tab → `Report a vulnerability`. Preferred.
2. Email the maintainer directly with subject prefix `[claude-loadout security]`.

Please include:
- A description of the issue and the impact
- Steps to reproduce (a minimal repro repo is gold)
- The version (`claude-loadout --version` or commit SHA)
- Your suggested severity, if any

We will acknowledge within **5 business days** and aim to ship a fix or mitigation within **30 days** for high-severity issues. We coordinate disclosure: you'll be credited (unless you prefer to stay anonymous) after the fix lands.

## Threat model

`claude-loadout` operates across two trust boundaries:

| Boundary | What we trust | What we don't |
|---|---|---|
| **Author → bundle** | The author's intent. Their hand-edited bundle. | We do not trust that secrets won't slip in — that's why `sanitize` exists. The pass is **best-effort**, not a guarantee. |
| **Bundle → installer** | The manifest's declared file list. Validated paths only. Declarative items only. | Hooks (executable shell) are **never imported by default** in v0.1. Override is a per-install opt-in, never a config flag set once and forgotten. |

### What we explicitly defend against

- **Path traversal in alias names** — `removeProfile` / `showProfile` reject aliases that resolve outside `profilesDir`.
- **Partial installs** — if a manifest references a file that's missing from the bundle, install fails before any state is written.
- **Failed updates corrupting working installs** — `updateProfile` stages the new bundle to `<alias>.update-staging` and atomic-swaps; a failed update leaves the existing install untouched.
- **Hostile shell on install** — hook items are skipped unless `--allow-hook-import` is explicitly set on that single install invocation.

### What we don't (yet) defend against

- A bundle author with a private allow-listed pattern can still author CLAUDE.md text that prompt-injects an installer's session. Treat installed CLAUDE.md the same way you'd treat a third-party `.bashrc` snippet — read it before activating.
- The sanitize regex catalogue does not catch every secret format. Custom `deny` patterns plus manual review remain necessary for sensitive bundles.
- Symlink-based attacks during bundle copy are not mitigated; we follow the manifest's declared paths but do not currently `lstat` them. If you need that hardening, please file an issue.

## Hardening recommendations

If your team distributes loadouts in an org context:
- Pin the source ref at install time (`--ref <sha>`) for auditability.
- Enable branch protection on the bundle repo so `main` requires review.
- Run `claude-loadout sanitize <bundle>` in CI for the bundle repo, not just on author's machine.
- Treat `--allow-hook-import` as a privileged operation; review any hook script line-by-line before allowing.
