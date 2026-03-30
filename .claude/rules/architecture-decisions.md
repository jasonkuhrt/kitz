# Architecture Decisions

## Package-Local ADRs

Packages record architecture decisions in two places:

- **Ledger**: the Key Decisions table in `packages/<name>/CONTRIBUTING.md` — compact rows (decision, why, alternative rejected, link)
- **Detail**: `packages/<name>/docs/rationales/NNNN-slug.md` — full rationale (Context, Decision, Result)

Numbered per-package starting from `0001`. Same format as root `docs/rationales/`.

The Key Decisions section in CONTRIBUTING.md follows the `/readme` skill's CONTRIBUTING.md protocol (section 5 of 6 required sections).

## Root-Level ADRs

Project-wide decisions (build system, workspace conventions) go in `docs/rationales/` with the existing numbering sequence.
