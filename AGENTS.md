# Kitz — Agent Guide

Canonical, cross-tool agent instructions for this repository. Claude Code loads
this file via a file-import from `.claude/claude.md`.

## Workflow

- **Package manager:** pnpm 11 (`pnpm-workspace.yaml`). Dev/CI runtime is Node (`>=22.13`). All workflows run through the Vite+ tasks defined in `vite.config.mts` (`run.tasks`), invoked with `vp run <task>`. There are intentionally **no equivalent `package.json` scripts** — `vp run` is the single task entrypoint (root `package.json` only carries `install:ci` and `prepare`).
- **Toolchain:** [Vite+](https://viteplus.dev) (`vp`) for test/lint/format, official TypeScript 7 (`tsc`) for build + typecheck. `effect` is a peer dependency pinned to the v4 beta line.
- **Test runner:** `vp run test` (Vitest, bundled by Vite+). Import the test API from `vite-plus/test` (`describe`, `it`, `test`, `expect`, `vi`) — NOT from `vitest` or `@effect/vitest`; vite-plus owns vitest and re-exports it, which keeps a single vitest copy (works under GVS). Do not install `vitest` directly. Test config lives in the root `vite.config.mts` (`test` block); `packages/effect/vitest.setup.ts` registers an Effect-`Equal`-aware equality tester on `expect`. Coverage providers are opt-in, pinned to the bundled vitest version (`@vitest/coverage-v8@4.1.9`).
- **Build / typecheck:** `vp run build` (`tsc -b tsconfig.production.json`, file-by-file emit — no bundler; emits `.js` + `.d.ts`) and `vp run check:types` (`tsc -b tsconfig.development.json`).
- **Lint / format:** `vp run check:lint` (oxlint) and `vp run check:format` (oxfmt). Configuration for both lives in `vite.config.mts` (the `lint` and `fmt` blocks) — there is **no** `.oxlintrc.json` or `.oxfmtrc.json`. House style: single-quote, no-semi.
- Prefer the canonical `vp run` tasks over one-off shell commands when the workflow matters.
- Follow `.claude/rules/commit-conventions.md` when writing git commits or PR titles.
- Treat `oxlint` warnings as blocking. Keep rule severities at `warn` so IDEs do not visually conflate lint findings with type-check errors, but do not close work while any `oxlint` warning is still live.

Task reference (run as `pnpm exec vp run <task>`, or `vp run <task>` if `vp` is on `PATH`):

```bash
vp run build          # tsc -b tsconfig.production.json (emit .js + .d.ts, no bundler)
vp run check:types    # tsc -b tsconfig.development.json
vp run check:lint     # oxlint
vp run check:format   # oxfmt --check
vp run test           # vitest (bundled by Vite+)
vp run check:cov      # vitest --coverage
vp run check:package  # publint + attw on the built package (cwd: packages/effect)
vp run check          # format-check + lint + types
vp run fix            # format + lint --fix
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
