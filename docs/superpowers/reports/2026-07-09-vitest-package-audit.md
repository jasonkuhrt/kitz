# @kitz/vitest Package Audit

## Verdict

`@kitz/vitest` is small and mostly coherent: runtime setup registers the path matchers, the Effect-`Equal` equality tester works in a probe, and the existing path tests consume the package through the intended `@kitz/vitest` import. The main problems are not broad implementation rot; they are rename residue, a type-augmentation target that disagrees with Vite+'s upstream-module guidance, and missing first-party tests for the matcher layer itself.

## Findings

### P2 — `toBeRoot` still exposes root vocabulary for anchor behavior

Evidence: `packages/vitest/src/path.ts:16` documents `toBeRoot` as "root/anchor"; `packages/vitest/src/path.ts:111` implements it as `Kitz.Path.Dir.is(received) && received.isAnchor`; `packages/vitest/src/path.ts:116` and `packages/vitest/src/path.ts:117` still name and message the matcher as root. The current path vocabulary says dirs carry `isAnchor`, `AbsDir.anchor` / `RelDir.anchor` are the named values, and root is only the absolute anchor name (`packages/effect/README.md:146`, `packages/effect/README.md:151`, `packages/effect/README.md:153`, `packages/effect/README.md:154`; ledger row at `packages/effect/CONTRIBUTING.md:20`).

Fix direction: rename the matcher to `toBeAnchor`, update its declaration and messages to say anchor, and then update the lone current call site at `packages/effect/src/path/_.test.ts:320`.

### P2 — Matcher type augmentation targets the Vite+ shim instead of the upstream Vitest identity

Evidence: `packages/vitest/src/path.ts:6` declares `module 'vite-plus/test'`. Vite+'s installed migration guide says `vite-plus/test*` is only a thin re-export and augmentations must keep targeting upstream `vitest` / `@vitest/browser*` identities (`node_modules/vite-plus/docs/guide/migrate.md:121`); the installed shim confirms this (`node_modules/vite-plus/dist/test/index.d.ts:1`, `node_modules/vite-plus/dist/test/index.d.ts:2`). The matcher plumbing is owned by Vitest's upstream declarations: `Matchers` is declared in `@vitest/expect` (`node_modules/.pnpm/@vitest+expect@4.1.9/node_modules/@vitest/expect/dist/index.d.ts:181`) and `Assertion` extends it there (`node_modules/.pnpm/@vitest+expect@4.1.9/node_modules/@vitest/expect/dist/index.d.ts:635`).

Fix direction: move the custom matcher declaration to the upstream Vitest module identity used by Vite+ (`declare module 'vitest'`, following Vite+'s own guidance) so consumers get matcher types through the real interface merge.

### P2 — The matcher package has no tests for its own failure and negation branches

Evidence: all custom path matcher behavior is in `packages/vitest/src/path.ts:66` through `packages/vitest/src/path.ts:170`, but `find packages/vitest -maxdepth 2 -type f \( -name 'README*' -o -name '*.test.ts' -o -name '*.spec.ts' \)` returned no package README or package-local tests. Current usage in `packages/effect/src/path/_.test.ts` covers success paths only: examples include `toEncodeTo` at `packages/effect/src/path/_.test.ts:152`, `toBeRoot` at `packages/effect/src/path/_.test.ts:320`, and `toBeWithinPath` at `packages/effect/src/path/_.test.ts:612`; an `rg` scan found no `.not.toBe*` / `.not.toEncodeTo` matcher usage.

Fix direction: add a focused `packages/vitest/src/*.test.ts` suite that asserts positive, negative, invalid-received, invalid-parent, and message/diff behavior for every matcher.

### P3 — The matcher surface mirrors inclusive containment but not the strict genealogy split

Evidence: `toBeWithinPath` is the only containment matcher in the declaration (`packages/vitest/src/path.ts:18`, `packages/vitest/src/path.ts:19`) and implementation (`packages/vitest/src/path.ts:122`). The path API deliberately splits inclusive `isWithin` from strict `isDescendantOf` / `isAncestorOf` (`packages/effect/README.md:122`, `packages/effect/README.md:125`; `packages/effect/src/path/operations/isWithin.ts:8`, `packages/effect/src/path/operations/isDescendantOf.ts:8`, `packages/effect/src/path/operations/isAncestorOf.ts:8`). The current path suite has strict genealogy blocks that fall back to boolean assertions (`packages/effect/src/path/_.test.ts:617`, `packages/effect/src/path/_.test.ts:620`, `packages/effect/src/path/_.test.ts:628`, `packages/effect/src/path/_.test.ts:660`, `packages/effect/src/path/_.test.ts:668`).

Fix direction: add a strict companion matcher after settling the name, e.g. `toBeDescendantOfPath`, and leave `toBeWithinPath` as the inclusive matcher.

### P3 — Package lifecycle and dependency intent are undocumented

Evidence: `packages/vitest/package.json:4` marks the package private, `packages/vitest/package.json:7` through `packages/vitest/package.json:9` exports TypeScript source directly, and `packages/vitest/package.json:11` through `packages/vitest/package.json:20` mixes runtime `effect` / `vite-plus` dependencies with `@kitz/effect` as both dev and peer dependency. The ledger records the intended topology as framework-coupled matchers in `@kitz/vitest`, peer-depending on `@kitz/effect`, with the dev edge pointing back (`packages/effect/CONTRIBUTING.md:13`). No package README exists to state whether the source-only exports and `private: true` status are permanent private-workspace choices or parked publication work.

Fix direction: add a short package README documenting the intended lifecycle, why exports point at `src`, why `vite-plus` is pinned, and which dependencies are runtime peers versus local workspace wiring.

## Non-findings

- No dead custom path matcher was found: `toBeAbs`, `toBeRel`, `toBeFile`, `toBeDir`, `toBeRoot`, `toBeWithinPath`, and `toEncodeTo` all have current repo usage under `packages/effect/src/path/_.test.ts`.
- `toBeWithinPath` correctly wraps inclusive `Path.isWithin` for same-domain absolute/relative pairs (`packages/vitest/src/path.ts:54` through `packages/vitest/src/path.ts:63`, `packages/vitest/src/path.ts:122` through `packages/vitest/src/path.ts:136`); the runtime probe confirmed identity containment passes.
- The Effect-`Equal` equality tester is registered from the setup file (`packages/vitest/src/setup.ts:6`) and delegates to `Equal.equals` only when both operands implement Equal (`packages/vitest/src/index.ts:174` through `packages/vitest/src/index.ts:183`); the runtime probe confirmed `expect(...).toEqual(...)` works for an `Option` containing path values.
- Root test wiring uses `@kitz/vitest/setup` (`vite.config.mts:99`) and the package participates in the root TypeScript solution (`tsconfig.development.json:10` through `tsconfig.development.json:12`, `tsconfig.production.json:10` through `tsconfig.production.json:12`).
- Installed versions matched the spec assumptions: `effect@4.0.0-beta.85` and `vite-plus@0.2.1` were checked from `node_modules`; the workspace catalog also pins Effect beta.85 (`pnpm-workspace.yaml:15` through `pnpm-workspace.yaml:17`).

## Coverage Note

Audited `packages/vitest/src/index.ts`, `packages/vitest/src/path.ts`, `packages/vitest/src/setup.ts`, `packages/vitest/package.json`, the path API barrel, model getter/static evidence, path operation docs, README vocabulary notes, contributing ledger rows, root Vite+ test config, package tsconfigs, and current `packages/effect/src/**/*.test.ts` usage. Ran a scratch Vite+ probe from the provided scratchpad to verify Effect equality setup, inclusive `toBeWithinPath`, and current `toBeRoot` failure vocabulary; deleted the scratch test and scratch config afterward. `vp run check:types` returned a Vite Task cache hit, so no fresh full type/lint/build gate is claimed here; full gates were deliberately skipped because the task was report-only with no code fixes.
