# Kitz — Agent Guide

Canonical, cross-tool agent instructions for this repository. Claude Code loads
this file via a file-import from `.claude/claude.md`.

## Workflow

- **Package manager:** pnpm 12 (`pnpm-workspace.yaml`). Dev/CI runtime is Node (`^22.22.1 || ^24.11.0 || >=26.0.0`, the floor Vite+ 1.0 and its `vp staged` hook runner require). Day-to-day work uses first-class Vite+ commands directly (`vp lint`, `vp format`, `vp test`); multi-step or non-Vite+ workflows (tsc build, publint/attw) are `vp run <task>` tasks defined in `vite.config.mts` (`run.tasks`). Root `package.json` carries only `install:ci` and `prepare` — there are intentionally no script aliases for the first-class commands.
- **Toolchain:** [Vite+](https://viteplus.dev) (`vp`) for test/lint/format, official TypeScript 7 (`tsc`) for build + typecheck. The root `prepare` script runs `effect-tsgo patch` (`@effect/tsgo`), which swaps the installed `tsc` binary for the Effect language-service build, so every `tsc` run also enforces the Effect diagnostics tiered in `tsconfig.template.effect.json` (`tsconfig.template.effect.ruthless.json` is the opt-in all-error variant). `effect` is a peer dependency; its floor is the Effect release the workspace is tested against.
- **Test runner:** `vp test run` (Vitest, bundled by Vite+; `vp test` alone watches). Import the test API from `@kitz/vitest` (`describe`, `it`, `test`, `expect`, `vi`, plus `it.effect`, the native property runner (`it.effect.prop`, `assertProperty`), and the kitz matcher typings) — NOT from `vitest` or `@effect/vitest`; `@kitz/vitest` re-exports `vite-plus/test`, and vite-plus owns vitest. `vitest` is declared directly only as the peer that `@vitest/coverage-v8` requires (`packages/effect`); the workspace catalog and the `vitest@*` override in `pnpm-workspace.yaml` pin it to the exact version Vite+ bundles, so the graph keeps a single vitest instance. Test config lives in the root `vite.config.mts` (`test` block); the `@kitz/vitest/setup` setupFile registers the Effect-`Equal`-aware equality tester and the path matchers on `expect`. Coverage providers are opt-in, pinned to the bundled vitest version (`@vitest/coverage-v8@5.0.1`, via the catalog).
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

## Backwards Compatibility

**Default stance: Breaking changes are acceptable.**

This is a pre-1.0 library under active development. Unless explicitly instructed otherwise for a specific task, you should:

- Prioritize clean design over backwards compatibility
- Make breaking changes freely when they improve the API
- Not worry about migration paths or deprecation warnings
- Focus on the best long-term solution

Backwards compatibility will ONLY be considered when explicitly mentioned in the task requirements.
