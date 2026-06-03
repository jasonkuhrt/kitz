# Release `effect/unstable/cli` Migration — Implementation Plan

> **For agentic workers:** Execute phase-by-phase. Each phase ends green (typecheck + tests). Steps use `- [ ]`. Spec: `docs/superpowers/specs/2026-06-03-release-effect-cli-migration-design.md`.

**Goal:** Replace `@kitz/release`'s home-grown CLI (`@kitz/oak` + `@kitz/cli`) with core Effect's `effect/unstable/cli`, big-bang, idiomatically.

**Architecture:** One root `Command` tree (`Command.make("release").pipe(Command.withSubcommands([...]))`) run via `Command.run`. Each `commands/<name>.ts` exports a `Command` value; its handler is an `Effect` whose `R` requirements are satisfied by the command's existing `*CommandLayer` provided via `Command.provide`. Old dispatch (`Cli.dispatch`, `$default.ts`, `help.ts`) is deleted.

**Tech Stack:** `effect@4.0.0-beta.76` `unstable/cli` (`Command`, `Flag`, `Argument`, `Prompt`, `Completions`, `GlobalFlag`).

---

## Reference pattern (pinned during Phase 1 spike)

Oak (current):
```ts
const args = Oak.Command.create().use(Oak.EffectSchema).description("...")
  .parameter('format f', Schema.UndefinedOr(Schema.Literals([...])).pipe(/* default */))
  .parse()
Cli.run(SomeCommandLayer)(Effect.gen(function*() { /* uses args.format */ }))
```

effect/unstable/cli (target):
```ts
import { Argument, Command, Flag } from 'effect/unstable/cli'
export const forecast = Command.make('forecast', {
  format: Flag.choice('format', ['table','tree','md','json']).pipe(Flag.withAlias('f'), Flag.withDefault('table')),
  fromFile: Flag.string('from-file').pipe(Flag.optional, Flag.withDescription('...')),
}, ({ format, fromFile }) => Effect.gen(function*() { /* same body */ }))
  .pipe(Command.withDescription('Render a release forecast'), Command.provide(ForecastCommandLayer))
```

Mapping rules:
- `.parameter('name alias', Schema)` → `name: Flag.<kind>('name').pipe(Flag.withAlias('alias'), Flag.withDefault(...) | Flag.optional)`.
- Positional params (advertised `[pkg]`) → `Argument.<kind>('pkg').pipe(Argument.optional)`.
- `Schema.Literals([...])` enum flag → `Flag.choice('name', [...])`.
- Boolean → `Flag.boolean`. Secrets → `Flag.redacted`.
- `Cli.run(Layer)(body)` → handler `body` + `Command.provide(Layer)`.
- Nested (`archive export`, `pr title suggest`, `trust list|setup|verify`, `matrix verify`, `conformance run`) → parent `Command.make` + `Command.withSubcommands([...])`.

---

## Phase 1 — Spike: root tree + 3 representative commands (locks the API)

**Files:** Modify `packages/release/src/cli/cli.ts`; rewrite `commands/forecast.ts` (simple), `commands/explain.ts` (positional + prompt), `commands/archive.ts` (nested).

- [ ] Port `forecast` to the reference pattern; typecheck `packages/release`.
- [ ] Port `explain`: `pkg` as `Argument.optional` + `Argument.withFallbackPrompt(Prompt.select(...))` from the existing picker options; resolves #215 + picker.
- [ ] Port `archive` (nested `export`): parent `archive` + subcommand `export`; replaces hand-rolled `Cli.parseArgv` + `flagValue`; `-h` now framework-handled (#213).
- [ ] Rewrite `cli.ts`: build root `Command.make('release')` with `withSubcommands([forecast, explain, archive])` temporarily; `Command.run(root, { version })` provided `Layer.merge(Env.Live, FileSystemLayer)`. Confirm `release forecast`, `release explain @kitz/core`, `release archive export -h` all behave.
- [ ] Commit: `refactor(release): spike effect-cli root tree + forecast/explain/archive`.

## Phase 2 — Port remaining commands (batches, typecheck green per batch)

Each: convert params→Flag/Argument, move body into handler, `Command.provide(<its Layer>)`, export Command value, add to root tree.

- [ ] Batch A (simple, flag-only): `doctor`, `graph`, `history`, `init`, `preview`, `prove`, `reconcile`, `rehearse`, `repair`, `resume`, `status`, `validate-setup`, `forecast`✓.
- [ ] Batch B (positional/pkg): `notes` (positional `pkg` + workspace resolution → #216), `explain`✓.
- [ ] Batch C (plan/apply, larger): `plan` (`--lifecycle` via `Flag.choice`), `apply` (drop `--dry-run` dead code → #218; `Prompt.confirm`; `Flag.redacted` for OTP).
- [ ] Batch D (nested/imperative → Command): `pr` (`preview`|`title suggest|apply`), `trust` (`list|setup|verify`), `matrix verify`, `conformance run`, `inspect`, `prune`, `archive`✓.
- [ ] After each batch: `bun run --cwd packages/release check:types` → 0 errors; commit `refactor(release): port <batch> commands to effect-cli`.

## Phase 3 — Delete old infra + new capabilities

- [ ] `cli.ts`: final root tree with all subcommands; remove `Cli.dispatch`.
- [ ] Delete `commands/$default.ts`, `cli/help.ts` (+ `help.test.ts`).
- [ ] `ui`: light `Command` shell; dynamic `import('./ui-app.js')` + `@kitz/tui` inside handler (cold-start).
- [ ] Add `completions` via `Completions.generate` / `GlobalFlag` builtins.
- [ ] Remove `@kitz/oak` + `@kitz/cli` from `packages/release/package.json`; `bun install`.
- [ ] Commit: `refactor(release)!: remove oak/cli dispatch, adopt effect-cli help+completions`.

## Phase 4 — Tests + verification

- [ ] Replace `help.test.ts` with: root help renders command list; **#213 regression** — `-h` on `archive`/`prune`/`matrix`/`conformance` exits 0, no side effects (assert no file written).
- [ ] Add `notes` unknown-pkg test (#216) and `apply` no-`--dry-run` test (#218).
- [ ] `bun run --cwd packages/release check:types` → 0; `bun run --cwd packages/release test` → green; `bun run check:types` (all) → 0; `bun run test:packages` → green.
- [ ] `bun run check:lint` → no warnings.
- [ ] Commit: `test(release): regression tests for effect-cli help/bugfixes`.

## Phase 5 — Land

- [ ] Push `chore/effect-catalog-beta76`; open PR with title `feat(release)!: migrate CLI to effect/unstable/cli + effect beta.76 catalog`.
- [ ] PR body: summarize dep sweep + CLI migration, bugs fixed (#213/#215/#216/#218), behavior changes (help/error/completions output differs — adopt-effect-cli decision), and the cold-start `ui` note.

## Risks / stop-and-document conditions

- If `effect/unstable/cli` cannot express a current behavior (e.g. a specific layer-provision or prompt shape), stop, leave the branch green at the last good commit, and document the gap in the PR body rather than guessing.
- `unstable/` API: pinned `beta.76`.
