# Migrate `@kitz/release` CLI to `effect/unstable/cli`

- **Date**: 2026-06-03
- **Status**: Design (approved decisions captured; pending final spec review)
- **Pins**: `effect@4.0.0-beta.76` (the CLI lives in the **`unstable/`** namespace — this spec is verified against beta.76 and must be re-verified if effect is bumped)
- **Prerequisite (DONE)**: Step 0 — `effect` bumped `beta.70 → beta.76` via a new bun catalog; `@kitz/flo` adapted to the new `Workflow.make` signature. Commit `e8bafb20`. Verified: full typecheck green, 2833 tests pass.

## Goal

Replace release's two home-grown, Effect-based CLI packages (`@kitz/oak` arg parser + `@kitz/cli` framework) with core Effect's `effect/unstable/cli`, **idiomatically** — designing from the framework's idioms and release's domain, not porting the old shape 1:1. Exploit the capabilities the new framework unlocks.

## Scope decisions (approved)

| Decision | Choice | Rationale |
|---|---|---|
| End state for `@kitz/oak` / `@kitz/cli` | **Keep** both; release stops consuming them | Release-only migration; smaller blast radius; no aggregator/deletion churn. They become product-unused (kept for potential future use). |
| Observable surface | **Adopt effect cli conventions** | Framework owns help, errors, `--help`, completions. Delete release's hand-rolled `help.ts`/renderers where superseded. |
| Sequencing | **Big-bang complete cut** (Approach A) | No transitional dual-dispatch shim; the dispatch-model swap happens once. Matches the project's "complete cut" stance. |
| PR topology | **One combined PR** with Step 0 | User choice. Re-couples failure domains (dep bump + CLI); accepted. |

### Non-goals

- Deleting `@kitz/oak` / `@kitz/cli`.
- Migrating other consumers (`kitz` aggregator re-exports; `oak → cli` internal dependency).
- A broader repo-wide all-deps sweep (only `effect` + `type-fest` were cataloged in Step 0).

## Architecture: the dispatch-model swap (the core change)

Current model — **file-based routing**:
- `cli.ts` calls `Cli.dispatch(commandsDir)`, which dynamically imports `commands/<name>.ts` per argv.
- Each command file is an independent `Cli.run(layer)(...)` program.
- `commands/$default.ts` handles unknown-command + root help.
- `cli/help.ts` hand-rolls root help (`formatRootHelp`, `isRootHelpRequest`, `rootCommands`).

New model — **one root `Command` tree**:
- `cli.ts` builds `Command.make("release").pipe(Command.withSubcommands([...all subcommands]))`, then `Command.run(root, { version })`, provided the release layer (`Env`, `FileSystem`, `Api.*`) **once** at the root.
- **Deleted**: `Cli.dispatch` usage, `commands/$default.ts`, `cli/help.ts`, and per-command `flagValue`/help-flag helpers.

This collapses 25 independent `Cli.run(layer)` entry points into one composable `Effect` with a single provided layer — the handlers' `R` requirements propagate up the tree to the root `run`.

## Per-command shape

Each `commands/<name>.ts` exports a `Command` **value** (not a self-running program):

```ts
export const explain = Command.make("explain", {
  pkg: Argument.string("pkg").pipe(Argument.optional, Argument.withFallbackPrompt(Prompt.select(/* picker */))),
  format: Flag.choice("format", ["text", "json"]).pipe(Flag.withAlias("f"), Flag.withDefault("text")),
}, ({ pkg, format }) => Effect.gen(function*() { /* handler */ }))
  .pipe(Command.withDescription("Explain why a package is primary, cascade, or unchanged"))
```

Nested commands (`archive export`, `pr title suggest`, `trust setup`, `matrix verify`, `conformance run`) → parent `make` + `withSubcommands`.

## Idiomatic unlocks adopted

**Tier 1 — each deletes existing hand-rolled code or kills a bug:**
- `Argument.fileSchema(name, schema)` — decode `.release/plan.json` straight into the typed `PlanEnvelope` at the CLI boundary → deletes `loadPlan` / `formatInvalidPlanMessage` / `formatMissingPlanMessage` plumbing.
- `Argument.optional` + `withFallbackPrompt(Prompt.select(...))` — explain's pkg picker → deletes hand-rolled TTY detection + manual picker; fixes #215 + picker in one declaration.
- `Flag.choice` — `--lifecycle official|candidate|ephemeral`, `--format json|text` → deletes string-then-validate; also avoids the documented beta `Schema.Literal` multi-arg footgun.
- `Flag.redacted` + `Prompt.password` (`Redacted`) — npm OTP/tokens never logged.
- `GlobalFlag.BuiltIns` (Help, Version, Completions, LogLevel) — deletes `help.ts`; **kills #213 structurally**.

**Tier 2 — idiomatic, ~zero net code:**
- Root global/shared flags via `withGlobalFlags`/`withSharedFlags` for cross-cutting flags every command re-declares today.
- Validating path primitives (`Flag.file`/`directory`/`path`).
- `withSchema` to push scalar validation to the boundary.

**Tier 3 — opt-in:**
- **Completions** (`Completions.generate`): **YES** — net-new capability.
- `withFallbackConfig`: **NO** — verified no release command uses env/config as a flag fallback today (the `apply.ts` `USER`/`HOST`/`KITZ_RELEASE_PROCESS_ID` reads are ambient runtime identity, not flag defaults).

## `ui` command — cold-start handling

`effect/unstable/cli` builds an eager subcommand tree (`withSubcommands` takes built Commands, not lazy thunks). The framework itself has **no boot cost** — `Command.make` is pure data; the cost is plain ESM module evaluation. `ui` is the one heavy command (imports `@kitz/tui` + `react@19` + opentui `Dashboard`). It stays a normal subcommand, but its handler **dynamic-`import()`s** the TUI stack — the single justified exception to the static-import rule, gated behind `release ui`. The other 24 import statically.

## The 4 open release-CLI bugs, absorbed by construction

| Bug | Resolution |
|---|---|
| #213 (`-h` runs side effects) | `CliError.ShowHelp` intercepts `-h`/`--help` before handlers, exits 0 — structurally impossible to run a body on help |
| #215 (positional `[pkg]` dropped) | `pkg` declared as `Argument` (positional) on `explain` + `notes` |
| #216 (`notes --pkg` unvalidated) | `notes` handler resolves pkg vs workspace (reuse `resolveExplainPackage`), errors on unknown |
| #218 (`apply --dry-run` dead code) | Drop the flag + JSDoc + dead branches; `preview` already replaces it |

## Testing

- Delete `help.test.ts` (it tests `formatRootHelp`, which is deleted).
- Add: root-help renders the command list via effect cli; **#213 regression** — `-h` on `archive`/`prune`/`matrix`/`conformance` exits 0 with **no side effects**.
- Reuse `explain-lib` resolution tests; each ported command keeps/updates its behavioral tests.

## Risks

- `effect/unstable/cli` is an `unstable/` namespace — pinned to `beta.76`; re-verify on any effect bump.
- Eager module graph: mitigated for `ui` via dynamic import; the other 24 are light enough.

## Open items

None blocking. Idempotency/semantic concerns from Step 0 are resolved.
