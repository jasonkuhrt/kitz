---
name: filing-issues
description: Use when filing a GitHub issue for this repo — a bug found during QA/stress-testing, or a feature/enhancement request. Enforces the two permitted cold-startable formats (bug = Expected/Actual, feature = Current/Desired), point-form-only bodies, and the gh filing procedure. Trigger on "file an issue", "open a bug", "log this finding", "make a gh issue", or after stress-testing surfaces a defect.
---

# Filing Issues

Every finding becomes one **cold-startable** GitHub issue: a future agent with zero prior context must be able to reproduce and fix it from the issue body alone.

Only two issue kinds are permitted. No other shape.

## Hard rules

- Exactly the two H1 headings for the kind. No extra headings, no preamble, no closing prose.
- **Under every heading: bullet points only.** No paragraphs, no tables, no numbered lists. One fact per bullet.
- Cold-startable: the bullets must carry everything a fresh agent needs — exact repro command, observed output, `file:line` of the root cause, and the fix direction. Put these as bullets under the *Actual* (bug) or *Current* (feature) heading.
- Title follows Conventional Commits, matching repo issue history: `type(scope): summary` (e.g. `fix(release): ...`, `feat(cli): ...`). Scope = package name without `@kitz/`.
- Label: bug kind → `bug`; feature kind → `enhancement`.
- Dedupe before filing (see Procedure).

## Kind 1 — Bug

Title: `fix(<scope>): <one-line summary>`

```markdown
# Expected behaviour

- <what should happen, one fact per bullet>

# Actual

- <what happens instead>
- Repro: `release <exact command>`
- Output: `<the wrong output, verbatim or trimmed>`
- Root cause: `packages/<pkg>/src/<file>.ts:<line>` — <why it misbehaves>
- Fix direction: <the concrete change a future agent should make>
```

## Kind 2 — Feature

Title: `feat(<scope>): <one-line summary>`

```markdown
# Current behaviour

- <how it works today>
- Evidence: `packages/<pkg>/src/<file>.ts:<line>` — <the limiting code>

# Desired behaviour

- <what we want instead>
- <acceptance criterion, one per bullet>
```

## Cold-start checklist (every issue)

A future agent reads ONLY the issue. Confirm the bullets answer:

- What command/input triggers it? (exact, copy-pasteable)
- What did it do vs. what should it do?
- Where in the source does it live? (`file:line`)
- What is the intended fix or acceptance criterion?

If any answer is missing, the issue is not cold-startable — add the bullet.

## Procedure

1. **Confirm the finding reproduces** under a clean invocation. A test-rig artifact (shell quoting, stale build) is not a bug — verify before filing.
2. **Dedupe:** `gh issue list --state open --search "<keyword>"`. If it exists, comment instead of filing.
3. **Write the body to a file** (avoids shell-escaping corruption of backticks/newlines):
   - Put the markdown in a temp file, e.g. `/tmp/issue-body.md`.
4. **File it:**
   ```bash
   gh issue create \
     --repo jasonkuhrt/kitz \
     --title "fix(release): <summary>" \
     --label bug \
     --body-file /tmp/issue-body.md
   ```
   Or use the helper: `scripts/file-issue.sh <bug|feature> "<title>" /tmp/issue-body.md`
5. **Report the issue URL** back to the user.

## Notes

- One finding = one issue. Do not bundle unrelated findings.
- Related issues: cross-reference by number in a bullet (`Related: #123`).
- Never invent severity, time estimates, or speculation. State only verified facts.
