# 0154 Shared Plan Store

## Context

`release plan`, `release apply`, and `release doctor` each knew how to locate the active plan under `.release/plan.json`.

## Decision

Add a planner-owned active-plan store module that resolves the shared location from `Env`, exposes typed read/write/delete helpers, and provides one display path constant for CLI messaging.

## Result

Plan file lifecycle now lives behind one typed surface, the three commands no longer duplicate path handling, and planner-store coverage exercises the shared read/write/delete flow directly.
