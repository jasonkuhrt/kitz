# @kitz/linter

This README is a design document. The APIs shown here are target APIs, not current implementation.

`@kitz/linter` is a schema-first engine for building doctors and linters that stay declarative at the package boundary. It exists to let domain packages like `@kitz/release` describe:

- which facts a rule needs
- which settings a user may persist
- which runtime inputs a command provides
- which ambient services a host command provides
- which named rule bundles a command runs

without making the command itself manually assemble rule config, inject pseudo-config, or maintain a global registry.

## Why

Most doctor commands end up mixing five concerns:

- fact collection
- rule execution
- persisted config
- runtime-only command inputs
- ambient services

That coupling makes the command imperative. It also makes schema derivation weak, because values that are not actually config end up forced through the config layer.

`@kitz/linter` separates those concerns into first-class concepts.

## Core Model

### Fact

A fact is runtime context supplied to a lint run.

Examples:

- current pull request
- computed release plan
- monorepo package map
- git cleanliness snapshot

Facts are typed with Effect Schema. Absence is expressed in the fact value itself, usually via `Schema.NullOr(...)`, not by a separate mirrored boolean.

### Settings

Settings are persisted user configuration for a rule.

Examples:

- severity
- enabled mode
- a configured remote name
- a regex pattern

Settings must be JSON-schema-friendly because they should be derivable into a config schema artifact.

### Input

Input is runtime-only data provided by a named program.

Examples:

- `surface: 'preview' | 'execution'`
- a projected squash-commit header
- the active lifecycle being evaluated

Input is not persisted config.

### Service

A service is an ambient dependency supplied by the host command.

Examples:

- current working directory
- filesystem adapter
- git client
- process environment

Services are not persisted config, and they are not part of a program's user-facing input schema. They exist so values like `cwd`, `git`, or `fs` do not get incorrectly modeled as config or CLI input.

### Rule

A rule is a typed effect over:

- required facts
- decoded settings
- decoded runtime input
- declared services when needed

It returns either success metadata or one or more findings.

If `settings(...)` or `input(...)` are omitted, they default to `Schema.Struct({})`. The runtime stays schema-first, but authors should not need to spell empty structs repeatedly.

### Finding

A finding is a normalized observation emitted by a rule.

Statuses should cover the surfaces already present across your repos:

- `pass`
- `warn`
- `fail`
- `skip`
- `suggestion`

A finding may also carry:

- machine-readable code
- human message
- docs links
- fix instructions
- an optional safe fix effect

### Program

A program is a named composition of rules for a specific surface.

Examples:

- `doctor.apply`
- `doctor.preview`
- `pr.title`
- `ci.release`

A program decides:

- which rules are active
- which runtime inputs are supplied to each rule
- which rules are conditional on available facts
- how facts are collected for the run

Not every program produces the same kind of output. The engine should support three program kinds:

- `audit`: a rule-based report with findings
- `probe`: a typed snapshot for environment/status doctors
- `suite`: a hierarchical composition of child programs

### Probe

A probe is a typed diagnostic snapshot, not a pass/fail report.

Examples:

- `flo doctor`
- `os day doctor`
- `os notes doctor`
- `os finances doctor`

Probes still use Effect Schema and the same fact system, but their canonical output is a typed object schema instead of an audit report.

### Suite

A suite composes child programs and preserves namespacing in the result.

Examples:

- root `os doctor` delegating to day, email, notes, and finances
- `release doctor` evaluating multiple lifecycles
- future workspace-wide doctor surfaces

### Linter

A linter is the compiled result of the builder chain. It exposes:

- `Config` schema
- `Facts` schema
- `Services` schema
- `Report` schema
- per-program result schemas
- per-program input schemas
- the `run(...)` API
- JSON Schema emission helpers

## Design Principles

- No global rule registry. A linter runs the explicit catalog it was built with.
- No mirrored precondition booleans. Facts themselves express availability.
- No stringly `Record<string, unknown>` config.
- No persisted tuple shorthand in the canonical schema.
- No command-level rule mutation to force options into config.
- Every rule declares schemas, even when empty, so derivation stays uniform.
- One engine, three surfaces: audit, probe, suite.
- The public surface should be learnable from autocomplete and JSDoc without reading implementation files.
- The primary DX path is `run({ program, input, services, config })`, not manual fact assembly by every caller.

## Builder API

The builder accumulates facts, rules, and programs, then derives schemas from the full definition.

```ts
import { Effect, Schema } from 'effect'
import { Finding, Linter } from '@kitz/linter'

const ReleaseLint = Linter.create('release')
  .service('cwd', Schema.String)
  .fact('pr', Schema.NullOr(PrContext))
  .fact('diff', Schema.NullOr(DiffContext))
  .fact('gitStatus', GitStatus)
  .fact('monorepo', MonorepoContext)
  .fact('releasePlan', Schema.NullOr(ReleasePlan))
  .fact('releaseContext', Schema.NullOr(ReleaseContext))
  .rule(
    Linter.rule('env.publish-channel-ready')
      .describe('declared publish channel matches the active runtime')
      .settings(Schema.Struct({}))
      .input(
        Schema.Struct({
          surface: Schema.Literals(['preview', 'execution']),
        }),
      )
      .needs('releasePlan', 'releaseContext')
      .run(({ facts, input }) =>
        Effect.gen(function* () {
          const plan = facts.releasePlan
          const context = facts.releaseContext

          return plan === null || context === null
            ? undefined
            : {
                metadata: {
                  checked: true,
                  surface: input.surface,
                },
              }
        }),
      ),
  )
  .rule(
    Linter.rule('env.git-clean')
      .describe('git working directory has no uncommitted changes')
      .settings(Schema.Struct({}))
      .input(Schema.Struct({}))
      .needs('gitStatus')
      .run(({ facts }) => {
        return facts.gitStatus.isClean
          ? undefined
          : Finding.fail({
              code: 'env.git-clean',
              message: 'working tree is not clean',
            })
      }),
  )
  .program(
    Linter.auditProgram('doctor.apply')
      .collect(({ input, services }) =>
        gatherReleaseFacts({
          input,
          cwd: services.cwd,
        }),
      )
      .use('env.publish-channel-ready', {
        input: () => ({ surface: 'execution' }),
      })
      .use('env.git-clean'),
  )
  .program(
    Linter.auditProgram('doctor.preview')
      .collect(({ input, services }) =>
        gatherReleaseFacts({
          input,
          cwd: services.cwd,
        }),
      )
      .use('env.publish-channel-ready', {
        input: () => ({ surface: 'preview' }),
      }),
  )
  .build()
```

The important part is that the chain is cumulative and closed over by `.build()`. After build, the derived schemas are final and exact.

## Fact Collection

Programs should own fact collection.

That gives two benefits:

- command code becomes `parse args -> run program`
- suite programs can compose child programs without each caller rebuilding their fact graph manually

```ts
const ReleaseDoctor = Linter.auditProgram('doctor.apply')
  .input(DoctorCliInput)
  .collect(({ input, services }) =>
    Effect.gen(function* () {
      const config = yield* loadReleaseConfig(services.cwd)
      const plan = yield* readActivePlan(services.cwd, input.lifecycle)
      const gitStatus = yield* readGitStatus(services.cwd)

      return {
        config,
        plan,
        gitStatus,
      }
    }),
  )
```

Low-level execution should still allow direct fact injection for tests, but the primary DX path is program-owned collection.

## Required Facts

When a rule declares `.needs('releasePlan', 'releaseContext')`, the `run(...)` callback should see those facts as non-null and present.

This is a DX requirement, not a nice-to-have. Without it, every rule keeps re-checking the same nullable facts that the program already guaranteed.

## Program Kinds

The builder should expose distinct constructors for the three program kinds.

### Audit program

This is the classic lint/doctor case.

```ts
const DoctorApply = Linter.auditProgram('doctor.apply')
  .use('env.publish-channel-ready', {
    input: () => ({ surface: 'execution' }),
  })
  .use('env.git-clean')
```

### Probe program

This covers doctors that are structured environment snapshots rather than finding reports.

```ts
const FloDoctor = Linter.probeProgram('flo.doctor')
  .output(FloDoctorSnapshot)
  .run(({ facts }) =>
    Effect.succeed({
      configPath: facts.config.path,
      configExists: facts.config.exists,
      commands: facts.commands,
    }),
  )
```

If `.run(...)` is omitted for a probe program, the default should be identity over collected facts. The common case should not require `run(({ facts }) => Effect.succeed(facts))` boilerplate.

### Suite program

This covers aggregate doctors.

```ts
const OsDoctor = Linter.suiteProgram('os.doctor')
  .child('day', 'day.doctor')
  .child('email', 'email.doctor')
  .child('notes', 'notes.doctor')
  .child('finances', 'finances.doctor')
```

Suites should support mixed children. An `os.doctor` suite may aggregate several probe programs. A release suite may aggregate audit programs for `official`, `candidate`, and `ephemeral`.

## Fix Mode

Some of your doctor surfaces are not report-only. They detect drift and then reconcile it.

Examples:

- `shan skills doctor`
- `madmod doctor --fix`

The engine should make fix execution first-class, but safe fixes belong on findings, not on rules. Rules detect. Findings optionally declare how they can be reconciled.

```ts
const StaleBarrels = Linter.rule('barrels.stale')
  .settings(Schema.Struct({}))
  .input(Schema.Struct({}))
  .needs('workspace')
  .run(({ facts }) =>
    Effect.succeed(
      facts.workspace.staleBarrels.map((path) =>
        Finding.fail({
          code: 'barrels.stale',
          message: `${path} is stale`,
          safeFix: ({ services }) => regenerateBarrel(services.cwd, path),
        }),
      ),
    ),
  )
```

Programs should run in one of these modes:

- `check`
- `fix`

In `fix` mode, the engine should:

- run detection
- apply only findings with safe fixes
- emit both original findings and fix outcomes

This keeps auto-fix workflows declarative instead of pushing fix orchestration into each CLI command.

## Settings vs Input

This split is the most important part of the design.

If a value belongs in a checked-in config file, it is `settings`.

If a value is derived by the command for a single run, it is `input`.

Examples:

- `remote: 'origin'` can be a setting
- `surface: 'execution'` is input
- `projectedHeader: string` is input
- `severity: 'error' | 'warn'` is a setting

This keeps the emitted config schema clean. Runtime-only values never leak into persisted config.

## Services vs Input

This split is equally important.

If a value is supplied by the host environment and not by the user for a single run, it is a `service`.

Examples:

- `cwd` is usually a service
- `git` is a service
- `fs` is a service
- `lifecycle: 'official'` is input
- `surface: 'execution'` is input

This keeps CLI input schemas small and meaningful.

## Canonical Config Shape

The canonical config shape should be object-only and JSON-schema-friendly.

```ts
{
  defaults?: {
    enabled?: boolean | 'auto'
    severity?: 'error' | 'warn'
  }
  rules?: {
    'env.publish-channel-ready'?: {
      enabled?: boolean | 'auto'
      severity?: 'error' | 'warn'
      settings?: {}
    }
    'env.git-remote'?: {
      enabled?: boolean | 'auto'
      severity?: 'error' | 'warn'
      settings?: {
        remote: string
      }
    }
  }
}
```

This shape is ideal for:

- TypeScript inference
- Effect Schema decoding
- JSON Schema emission
- editor support for JSON config files
- machine-written config updates

The runner may transform primitive config values into richer runtime representations after decode, but the persisted schema should stay primitive.

## Derived Schemas

The built linter should expose schema values directly:

```ts
ReleaseLint.Config
ReleaseLint.Facts
ReleaseLint.Services
ReleaseLint.Report
ReleaseLint.Program('doctor.apply').Input
ReleaseLint.Program('doctor.apply').Result
```

That lets a domain package embed the linter config schema inside a bigger schema:

```ts
const ReleaseConfig = Schema.Struct({
  trunk: Schema.String,
  publishing: Publishing,
  lint: Schema.optional(ReleaseLint.Config),
})
```

It also lets tooling emit JSON Schema artifacts:

```ts
const schema = Linter.toJsonSchema(ReleaseLint.Config)
```

or

```ts
yield *
  Linter.emitJsonSchema({
    schema: ReleaseLint.Config,
    path: 'dist/release-lint.schema.json',
  })
```

## Running

Programs are the stable entrypoints used by commands.

```ts
const report =
  yield *
  ReleaseLint.run({
    program: 'doctor.apply',
    mode: 'check',
    input: {
      lifecycle: 'official',
    },
    services: {
      cwd: process.cwd(),
    },
    config: releaseConfig.lint,
  })
```

CLI filters like `onlyRule` and `skipRule` are run selectors, not persisted config. They belong in the run request, not in `ReleaseLint.Config`.

Probe runs should be equally direct:

```ts
const snapshot =
  yield *
  OsDiagnostics.run({
    program: 'flo.doctor',
    input: {},
    services: {
      cwd: process.cwd(),
    },
  })
```

Suite runs should preserve the child structure:

```ts
const suite =
  yield *
  OsDiagnostics.run({
    program: 'os.doctor',
    mode: 'check',
    input: {},
    services: {
      cwd: process.cwd(),
    },
  })
```

## Conditional Input Derivation

The release and suite examples expose a common pattern: a rule or child program is active only when the engine can derive its input.

Separate `when(...)` and `input(...)` callbacks are too clumsy for this. The ideal API should support `inputWhen(...)`.

```ts
.use('pr.projected-squash-commit-sync', {
  inputWhen: ({ facts }) =>
    facts.pullRequest === null || facts.pullRequest.projectedHeader === null
      ? null
      : { projectedHeader: facts.pullRequest.projectedHeader },
})
```

```ts
.child('official', 'doctor.lifecycle', {
  inputWhen: ({ input }) =>
    selectLifecycles(input).includes('official')
      ? { lifecycle: 'official', surface: 'execution' }
      : null,
})
```

If `inputWhen(...)` returns `null`, the rule or child is skipped. If it returns an object, that object is the exact typed input for the target rule or child program.

This collapses gating and input derivation into one place and removes duplicate nullable checks.

## Rule Return Ergonomics

Rules should be able to return the smallest useful shape:

- `undefined` for no findings
- a single `Finding`
- an array of `Finding`
- optional success metadata when needed

The engine should normalize those shapes internally. Authors should not need to wrap every branch in `Effect.succeed([])` just to satisfy the runtime.

## Audit Report Model

The audit report should preserve the useful parts of the current release doctor model while covering the richer doctor variants elsewhere:

- passed rule
- skipped rule
- failed rule execution
- finished rule with finding
- suggestion finding
- fixable finding
- applied-fix result
- optional metadata for successful checks
- first-class fixes, hints, docs, and locations

That model is already rich enough for:

- text output
- JSON output
- PR comments
- structured CI annotations

Probe programs should not be coerced into this model. Their canonical result is the declared output schema.

Suite programs should return a hierarchical result that preserves child program names and result schemas.

## Grouping And Views

Several of your doctors need categories or multiple render modes.

Examples:

- `dotctl doctor` groups by config/source/plan/manifest/state/repo and supports focus, sectioned, compact, table, and tree views
- `crossmod doctor` groups by setup/environment/lint/suggestion

The core engine should not hard-code those renderers, but it should carry enough metadata to support them cleanly:

- optional rule group
- optional rule namespace
- optional display priority
- optional program-specific view hints

That keeps renderers data-driven rather than dependent on parsing rule names after the fact.

## DX Conclusions From The Example Rewrites

Rewriting release, os, polen, bookmarks, dotctl, crossmod, flo, and shan against the same builder surfaced a few requirements that are now part of the ideal API:

- `services` must be first-class and schema-defined
- probe programs need an identity default so they do not require trivial `.run(...)`
- suite programs need aliased `.child(...)`, not unstructured include lists
- conditional activation should use `inputWhen(...)` when input derivation and gating are the same concern
- `mode: 'check' | 'fix'` belongs on `run(...)`, not in program input
- safe fixes must live on findings
- rule grouping and priority should be metadata, not naming conventions
- the engine should normalize single finding vs array vs empty return forms

## Using `@kitz/linter` Inside `@kitz/release`

`@kitz/release` should own:

- release-specific fact schemas
- release-specific rules
- release-specific programs
- lifecycle matrix and doctor formatting

`@kitz/linter` should own:

- the chain builder
- schema derivation
- config decoding
- rule execution
- report generation
- JSON Schema emission

That means `release doctor` stops manually enabling rules or injecting derived values into config. Instead it:

1. chooses a named program or suite such as `doctor.apply`
2. passes CLI input and user config
3. lets the program collect facts and run in the requested mode
4. renders the report or suite result

## Example `release.config.ts`

```ts
export default defineConfig({
  trunk: 'main',
  lint: {
    defaults: {
      severity: 'error',
    },
    rules: {
      'env.git-remote': {
        settings: {
          remote: 'origin',
        },
      },
      'pr.scope.require': {
        severity: 'warn',
      },
    },
  },
})
```

## Non-Goals

- Recreating domain-specific fact collection inside the linter engine
- Encoding runtime-only input into persisted config
- Supporting multiple shorthand config syntaxes as the canonical schema
- Making commands responsible for knowing per-rule settings or input schemas

## Examples

The runnable-style design examples live under [examples/README.md](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/README.md).

They cover release, os, polen-style diagnostics, bookmarks, dotctl, crossmod, flo, and shan.

## Coverage Check

This design is intended to cover the current doctor/linter shapes across your repos:

- `@kitz/release doctor`: audit programs plus lifecycle suite aggregation
- `os day|email|notes|finances doctor`: probe programs with typed JSON output
- root `os doctor`: suite aggregation over child doctors
- `bookmarks doctor`: independent read-only audit checks with fix guidance
- `dotctl doctor`: audit checks with warn/skip states and renderer-specific grouping
- `crossmod doctor`: audit checks plus suggestions and safe fix mode
- `shan skills doctor`: typed findings plus reconciliation/fix mode
- `flo doctor`: probe snapshot of environment and command availability

If a package has a pure status/snapshot doctor and no finding model, it should use a probe program. If a package emits actionable findings, it should use an audit program. If a package delegates to sub-doctors, it should use a suite program.

## Build Output

If a package wants a JSON Schema artifact for editor integration, that should be a build step driven from the repo workflow layer, not handwritten documentation. The schema artifact should be emitted from the same built linter definition that powers runtime decoding so the package contract stays single-sourced.
