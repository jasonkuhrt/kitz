# Kitz — Agent Guide

Canonical, cross-tool agent instructions for this repository. Claude Code loads
this file via a file-import from `.claude/claude.md`.

## Workflow

- **Package manager:** pnpm 11 (`pnpm-workspace.yaml`). Dev/CI runtime is Node (`>=22.13`). Day-to-day work uses first-class Vite+ commands directly (`vp lint`, `vp format`, `vp test`); multi-step or non-Vite+ workflows (tsc build, publint/attw) are `vp run <task>` tasks defined in `vite.config.mts` (`run.tasks`). Root `package.json` carries only `install:ci` and `prepare` — there are intentionally no script aliases for the first-class commands.
- **Toolchain:** [Vite+](https://viteplus.dev) (`vp`) for test/lint/format, official TypeScript 7 (`tsc`) for build + typecheck. `effect` is a peer dependency pinned to the v4 beta line.
- **Test runner:** `vp test run` (Vitest, bundled by Vite+; `vp test` alone watches). Import the test API from `vite-plus/test` (`describe`, `it`, `test`, `expect`, `vi`) — NOT from `vitest` or `@effect/vitest`; vite-plus owns vitest and re-exports it, which keeps a single vitest copy (works under GVS). Do not install `vitest` directly. Test config lives in the root `vite.config.mts` (`test` block); `packages/effect/vitest.setup.ts` registers an Effect-`Equal`-aware equality tester on `expect`. Coverage providers are opt-in, pinned to the bundled vitest version (`@vitest/coverage-v8@4.1.9`).
- **Lint / format:** `vp lint` (oxlint) and `vp format` (oxfmt; add `--check` to verify without writing). Configuration for both lives in `vite.config.mts` (the `lint` and `fmt` blocks) — there is **no** `.oxlintrc.json` or `.oxfmtrc.json`. House style: single-quote, no-semi.
- **Build / typecheck:** `vp run build` (`tsc -b tsconfig.production.json`, file-by-file emit — no bundler; emits `.js` + `.d.ts`) and `vp run check:types` (`tsc -b tsconfig.development.json`).
- Prefer first-class `vp` commands and the canonical `vp run` tasks over one-off shell commands when the workflow matters.
- Follow `.claude/rules/commit-conventions.md` when writing git commits or PR titles.
- Treat `oxlint` warnings as blocking. Keep rule severities at `warn` so IDEs do not visually conflate lint findings with type-check errors, but do not close work while any `oxlint` warning is still live.

Command reference:

```bash
# First-class Vite+ commands — run directly:
vp lint                   # oxlint
vp format                 # oxfmt (write); add --check to verify only
vp test run               # vitest, run-once (omit `run` to watch)
vp test run --coverage    # vitest with coverage

# Project tasks (wrap tsc / publint / compose steps) — via `vp run <task>`:
vp run build              # tsc -b tsconfig.production.json (emit .js + .d.ts, no bundler)
vp run check:types        # tsc -b tsconfig.development.json
vp run check:package      # publint + attw on the built package (cwd: packages/effect)
vp run check              # vp format --check + vp lint + tsc -b development
vp run fix                # vp format + vp lint --fix
```

> History: this repo was previously a 48-package bun-pure monorepo (bun runtime + bun:test + tsgo). It was collapsed to a single shippable package, `@kitz/effect`, and migrated to the pnpm + Vite+ + TS7 toolchain. The earlier `bun:test` / `@kitz/test` and "no vitest" guidance no longer applies.

## Backwards Compatibility

**Default stance: Breaking changes are acceptable.**

This is a pre-1.0 library under active development. Unless explicitly instructed otherwise for a specific task, you should:

- Prioritize clean design over backwards compatibility
- Make breaking changes freely when they improve the API
- Not worry about migration paths or deprecation warnings
- Focus on the best long-term solution

Backwards compatibility will ONLY be considered when explicitly mentioned in the task requirements.
