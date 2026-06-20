# CLAUDE.md

@issue.md
@../CONTRIBUTING.md

## Workflow

- **Package manager:** pnpm 11 (`pnpm-workspace.yaml`). Dev/CI runtime is Node (>=22.12). Drive workflows through the project-defined pnpm scripts.
- **Toolchain:** [Vite+](https://viteplus.dev) (`vp`) for test/lint/format, official TypeScript 7 (`tsc`) for build + typecheck. `effect` is a peer dependency pinned to the v4 beta line.
- **Test runner:** `vp test` (Vitest, bundled by Vite+). Import the test API from `vite-plus/test` (`describe`, `it`, `test`, `expect`, `vi`) — NOT from `vitest` or `@effect/vitest`; vite-plus owns vitest and re-exports it, which keeps a single vitest copy (works under GVS). Do not install `vitest` directly. Config lives in each package's `vite.config.ts` `test` block (not `vitest.config.ts`). `vitest.setup.ts` registers an Effect-`Equal`-aware equality tester on `expect`. Coverage providers are opt-in, pinned to the bundled vitest version (`@vitest/coverage-v8@4.1.9`).
- **Build/typecheck:** `pnpm build` (tsc, file-by-file emit — no bundler) and `pnpm check:types`.
- **Lint/format:** `pnpm check:lint` (oxlint via `vp lint`) and `pnpm check:format` (oxfmt via `vp format`; the scripts pass `--config .oxfmtrc.json` because vp 0.2.1 does not auto-discover it). House style: single-quote, no-semi.
- Prefer canonical repo or package scripts over one-off shell commands when the workflow matters.
- Follow `.claude/rules/commit-conventions.md` when writing git commits or PR titles.
- Treat `oxlint` warnings as blocking. Keep rule severities at `warn` so IDEs do not visually conflate lint findings with type-check errors, but do not close work while any `oxlint` warning is still live.

> History: this repo was previously a 48-package bun-pure monorepo (bun runtime + bun:test + tsgo). It was collapsed to a single shippable package, `@kitz/effect`, and migrated to the pnpm + Vite+ + TS7 toolchain. The earlier `bun:test`/`@kitz/test` and "no vitest" guidance no longer applies.

## Backwards Compatibility

**Default stance: Breaking changes are acceptable.**

This is a pre-1.0 library under active development. Unless explicitly instructed otherwise for a specific task, you should:

- Prioritize clean design over backwards compatibility
- Make breaking changes freely when they improve the API
- Not worry about migration paths or deprecation warnings
- Focus on the best long-term solution

Backwards compatibility will ONLY be considered when explicitly mentioned in the task requirements.
