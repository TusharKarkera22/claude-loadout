## What this changes

One paragraph. Skip the bullet-point summary if a sentence does the job.

## Why

Linked issue, or one-paragraph motivation.

## How to verify

The command(s) a reviewer should run. New tests are the usual answer.

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes; new behavior has a test that fails on `main`
- [ ] No new runtime dependencies (or, if there are: justified above)
- [ ] Safety boundary in `installProfile` (declarative-only) is preserved (or the change is called out explicitly)
- [ ] `CHANGELOG.md` entry added under `[Unreleased]` if the change is user-visible
