# CLI Framework Brainstorm

**Goal**: Consolidate all CLI infrastructure into one state-of-the-art `@kitz` CLI framework.

**Status**: Research phase — gathering inputs, identifying patterns, drafting design.

---

## Table of Contents

- [Inputs Inventory](#inputs-inventory)
- [Input Summaries](#input-summaries)
- [Cross-Cutting Analysis](#cross-cutting-analysis)
- [Design Decisions](#design-decisions)
- [Architecture Proposal](#architecture-proposal)
- [Open Questions](#open-questions)
- [Constraints & Strategic Direction](#constraints--strategic-direction)
- [Session Log](#session-log)
- [Raw Thoughts Index](#raw-thoughts-index)

---

## Inputs Inventory

| # | Source | Location | Status |
|---|--------|----------|--------|
| 1 | `@kitz/cli` | `packages/cli/` | Analyzed |
| 2 | `@kitz/oak` | `packages/oak/` | Analyzed |
| 3 | Clef | `~/projects/heartbeat-chat/Heartbeat-subimp-ui/libs/clef/` | Analyzed (refreshed 2026-03-12) |
| 4 | jasonkuhrt CLIs (8 found) | `~/projects/jasonkuhrt/` | Analyzed |
| 5 | `@effect/cli` | npm / Effect ecosystem | Analyzed |
| 6 | oclif | https://oclif.io | Analyzed |
| 7 | Hive Console CLI output system | https://github.com/graphql-hive/console/pull/6344 | Analyzed (prior art by jasonkuhrt) |

---

## Input Summaries

### 1. @kitz/cli — Foundational Layer

**What it is**: Low-level CLI infrastructure — file-based command dispatch, Effect program runner, token-level argument parsing.

**Key strengths**:
- File-based command routing (`dispatch()` scans a directory, matches argv to module filenames)
- `$default.js` convention for default commands
- `Cli.run(layer)(program)` — curried, data-last Effect entry point with SIGINT handling
- Compile-time AND runtime arg analysis (`Arg.Analyze<'--count=5'>` mirrors `analyze('--count=5')`)
- Param name parsing with alias support, negation detection (`--no-verbose`), cluster expansion (`-abc`)

**Key gaps**:
- Single-level dispatch only (no nested subcommands)
- Syntax parsing only — no value coercion, no schema validation
- No help/usage generation
- No `--count 5` (space-separated) handling at the framework level
- No variadic/repeatable arguments
- No positional argument support

**Verdict**: Solid foundation for token parsing and program entry. Needs everything above it.

---

### 2. @kitz/oak — Schema-Driven Argument Parser

**What it is**: CLI argument parsing framework using Standard Schema V1 (supports Zod and Effect Schema). ~8,167 LOC.

**Key strengths**:
- Builder with phantom type state machine — full type inference without annotations
- Schema-agnostic via Standard Schema V1 (Zod, Effect Schema adapters)
- Interactive prompting triggered by parse events (omitted, rejected, missing)
- Environment variable support with prefix handling
- Mutually exclusive parameter groups with smart typing
- Help generation from schema metadata (refinements, descriptions, defaults)
- Three-way optionality: required / optional / default

**Key gaps**:
- Single-command focused — no subcommand routing
- No positional arguments (flags only)
- No array/variadic parameters (`--file a --file b`)
- No async validation
- Prompt config is global, not per-parameter
- TypeScript depth limits on complex union types

**Verdict**: Excellent schema-to-CLI bridge. The Standard Schema V1 abstraction is the right bet. Needs command routing and positional args.

---

### 3. Clef — Full CLI Framework (Heartbeat)

**What it is**: Complete CLI framework promoted from an app-embedded module to a shared library (`libs/clef/`). 41 files (22 source + 19 tests including 5 type-level test files). The most feature-complete CLI framework in this inventory.

**Key strengths**:
- **Two execution surfaces**: Commands (persistent hierarchy with typed descriptors) and Scripts (pattern-matched one-offs with lazy loading)
- **CommandCatalog system**: First-class aggregate of commands + lazy namespaces, replacing flat registries
  - `defineCommand()` / `defineScript()` / `defineCommandNamespace()` / `defineCommandCatalog()` — identity helpers preserving `const` literal types
  - `mergeCommandCatalogs()` — last-write-wins merge of multiple catalogs
  - `buildRegistryFromCatalog()` — materializes catalog to flat registry for resolution
- **Two-tier lazy expansion**:
  - Execution-oriented: `expandCommandCatalogForPath()` — only expands namespaces matching path prefix
  - Metadata-oriented: `expandCommandCatalogMetadataForPath()` — prefers cheaper `loadMetadata` for help/completions
- **Three-way resolution**: exact match → namespace → longest-prefix fallback
- **Full shell completions** (bash/fish/zsh):
  - Shell-agnostic `CompletionModel` built from program + lazy namespaces
  - Per-command flag completions including enum values
  - Fish uses `__words`/`__depth_is`/`__path_is` custom functions for context-aware completion
  - Auto-refresh via SHA-256 digest (includes `COMPLETION_RENDERER_VERSION` for format-breaking changes)
  - Built-in commands: `completions print/install/path`
  - Atomic writes via temp file + rename
  - Auto-detects user's shell, installs to standard paths
- **Typed execution metadata**: `Clef.create().defineExecution<{ bootstrap: 'db' }>()` returns `ConfiguredClef<TExecution>` constraining all command/script definitions
- **ExecutionTarget discriminated union**: `{kind: 'command', command} | {kind: 'script', script}` replacing old `{label, module}` shape
- **Global args**: Parsed separately with custom `parse()`, `missingValueError`, `valueLabel`; `InferGlobalFlags<TSpecs>` derives types from specs
- **Local bin management**: Creates managed shims in `node_modules/.bin/` with shell hooks for bash (PROMPT_COMMAND), zsh (chpwd/precmd), fish (--on-variable PWD)
- **Module interop**: `normalizeModuleNamespace()` handles tsx/CJS double-wrapping
- **Script discovery**: `defineDiscoveredScripts()` scans directories, produces typed `ScriptDescriptor[]` with lazy loading and `describeScriptName()` humanization
- **Synchronous help entries**: `buildHelpEntries()` no longer async — metadata already on descriptors

**Key gaps**:
- No Effect integration (uses plain TS + Zod; only `effect` Array/String utilities in resolution)
- No middleware/plugin system
- No positional arguments
- No environment variable binding in schemas
- No Standard Schema V1 abstraction (Zod only)
- No async validation

**Verdict**: The most mature routing/catalog/completion system of all inputs. The two-tier lazy expansion (execution vs metadata), `ConfiguredClef<TExecution>` pattern, and completion auto-refresh with versioned digests are all steal-worthy. The catalog system is the answer to "how do you organize large command trees."

---

### 4. jasonkuhrt CLI Projects (8 CLIs)

| CLI | Framework | Key Pattern |
|-----|-----------|-------------|
| **dotctl** | Hand-written | Deployment planning, dry-run, manifest |
| **flo** | Hand-written + Effect | 20+ commands, git worktrees, `@clack/prompts`, JSON output |
| **bookmarks** | Effect.gen | Dry-run patches, daemon mode, multi-browser |
| **prbot** | Hand-written | Code generation, managed blocks |
| **madmod** (crossmod) | `@effect/cli` | Config-driven rules, daemon, watch mode |
| **shan** | Hand-written + Effect | Namespace-based routing, skill management |
| **os** | Hand-written + Effect | Multi-domain utility, namespace dispatch |
| **telescope** | Effect | Browser automation, data transforms |

**Cross-project patterns**:
- 60% use custom hand-written parsers → framework is clearly needed
- Effect is pervasive for async/error handling
- Common features: JSON output, dry-run, `doctor` commands, interactive prompts (clack)
- Namespace-based routing appears in shan, os, flo
- Only madmod uses `@effect/cli` — signals it didn't fully satisfy

**What the CLIs need but don't have**:
- Consistent argument parsing across all tools
- Shared help generation
- Shell completion
- Unified program entry with error formatting
- Daemon/watch mode infrastructure

---

### 5. @effect/cli — Effect-Native CLI Framework

**What it is**: The official Effect CLI library. Fully integrated with the Effect type system.

**Key strengths**:
- **Command IS an Effect** — `yield*` parent command in subcommand handler to access parsed config
- **Declarative composition**: `Options`, `Args`, `Command` composed via `.pipe()`
- **Wizard mode**: Interactive guided command construction, then shows assembled argv
- **Auto-correct**: Levenshtein-based flag suggestions
- **Config file loading**: JSON/YAML/INI/TOML via `ConfigFile.makeProvider()`
- **Built-in options**: `--help`, `--version`, `--wizard`, `--completions`, `--log-level`
- **Rich prompts**: text, password, integer, float, confirm, toggle, select, multi-select, list, date, file browser
- **Schema integration**: `Options.withSchema(schema)` and `Args.fileSchema(name, schema)`
- **Cardinality controls**: `repeated`, `atLeast(n)`, `atMost(n)`, `between(min, max)`
- **Relationship constraints**: `dependsOn`, `exclusive`, `exactlyOne`
- **Fallback chain**: flag → config file → env var → prompt

**Key gaps**:
- Not schema-first — you build `Options` and `Args` via its own constructors, not from existing schemas
- No plugin/extension system
- No lazy command loading (all commands loaded upfront)
- No file-based command routing
- No execution metadata pattern
- Prompt types are fixed (no custom renderers without `Prompt.custom()` low-level API)
- Wizard mode is interesting but niche

**Verdict**: The deepest Effect integration of any option. The fallback chain (flag → config → env → prompt) is the gold standard. But it's a closed system — you define CLI structure with its DSL, not from external schemas.

---

### 6. oclif — Enterprise CLI Platform

**What it is**: Salesforce/Heroku's CLI framework. Powers CLIs with hundreds of commands and millions of daily invocations.

**Key strengths**:
- **Plugin architecture**: Every CLI is a plugin. User-installable plugins, JIT plugins, loading order
- **Hook lifecycle**: `init`, `prerun`, `preparse`, `postrun`, `finally`, `command_not_found`, `command_incomplete` + custom
- **Manifest caching**: Serialized command metadata avoids loading all modules for help/routing
- **Release infrastructure**: Standalone tarballs with embedded Node, macOS .pkg, Windows NSIS, .deb, Snap, S3 distribution, autoupdating, release channels
- **JSON output mode**: `enableJsonFlag` → return value printed as JSON, `this.log` suppressed
- **Theming**: Ship theme.json, users override in config dir
- **Flexible taxonomy**: Commands match in any positional order
- **Command discovery strategies**: filesystem pattern, explicit map, single-command
- **Testing utilities**: `runCommand()` captures stdout/stderr

**Key gaps**:
- Class-based commands with manual `this.parse()` — types flow indirectly
- No functional composition (inheritance-only sharing)
- No built-in UX components (tables, progress, prompts deferred to npm)
- Manifest is a required build step (footgun in CI)
- Plugin system adds weight even for simple CLIs
- Variadic args are second-class (`strict = false` loses all arg validation)

**Verdict**: The only framework that solves the full lifecycle (scaffold → test → release → update → plugins). Steal: hooks, manifest caching, JSON mode, theming, flexible taxonomy. Replace: class model, manual parse, inheritance.

---

### 7. Hive Console CLI — Prior Art on Output Formatting [T18]

**What it is**: jasonkuhrt's design for generic text/JSON output support in The Guild's GraphQL Hive CLI (oclif-based). PR #6344 introduces an output definition system that's structurally relevant to DD-06.

**Key patterns** (on oclif, but the concepts transfer):

- **`Output.define()` + `Output.defineCaseSuccess()` / `Output.defineCaseFailure()`**: Commands declare their output as a set of typed cases (success variants, failure variants). Each case has a TypeBox schema for its data shape and an optional `text()` builder for human rendering.

- **Case-based output, not single-return**: A command doesn't return "a result" — it returns one of N possible output cases (e.g., `SuccessContext`, `FailureTokenNotFound`). Each case is a discriminated union member with its own schema and text renderer. This is richer than "text or json" — it's "which case occurred, rendered how."

- **Text builder receives a builder object**: `text(t, data)` where `t` has methods like `t.columns({ rows: [...] })`. The text builder is a structured renderer, not just `string → string`. This separates layout concerns from data concerns.

- **`--show-output-schema-json` flag**: Outputs the JSON Schema for the command's output definition. Makes the data contract discoverable and machine-parseable. Help class also renders a `JSON OUTPUT SCHEMA` section.

- **`Output.Definition.parseOrThrow()`**: The base command calls this to validate that `runResult()`'s return value matches the declared output definition. Runtime enforcement that the command's output matches its schema.

- **`toErrorJson()` in base command**: Errors are also structured output — parse failures, missing args, unknown flags all produce typed `Output.Result.Failure` objects with `type`, `message`, `suggestions`. Not just `process.exit(1)`.

- **Snapshot testing with value cleaners**: Custom snapshot serializer normalizes volatile data (tokens, IDs, URLs, timestamps) while preserving output structure. Enables deterministic test assertions on CLI output.

**Key limitation acknowledged by author**: The mapping from output case union → text renderer is **not type-safe**. Two specific gaps:

1. **`runTextBuilder` erases types**: The function signature is `(params: { caseDefinition: CaseDefinition; result: Result; input: object }) => string` — all three parameters are their base types, not the specific case. The `text()` callback receives `result.data` typed as `any` (via `TextBuilder<$Data = any>`). The type safety exists _within_ each `defineCaseSuccess()` call (the `text` callback parameter is correctly typed to the case's data shape), but it's lost at the dispatch site where `parseOrThrow` returns `{ result: Result, caseDefinition: CaseDefinition }` — both widened to base types. There's a `.find()` over `caseDefinitions` matching on `data.type` at runtime with no type narrowing.

2. **`as any` casts in definers**: Both `defineCaseSuccess` and `defineCaseFailure` return `as any` — the TypeBox composite type construction can't be followed by TypeScript, so the precise case schema type is manually asserted. This means the connection between the schema and the text builder's data parameter is _assumed correct_ rather than _proven_.

**What the Hive design DID solve**: Output types are spec'd upfront and the handler body is forced to return type-safe values. `runResult()` returns `Promise<Output.Definition.InferResults<$OutputDefinition>>` where `InferResults` is `T.Static<$Definition['caseDefinitions'][number]['schema']>` — the return type is the union of all case schemas. The `successData()`/`failureData()` helpers constrain what the handler can return. This is the "output side" that Oak never had — Oak was input-only (argv → typed object), with no concept of typed output at all.

**What's different for kitz**:
- Hive uses oclif class inheritance (`BaseCommand<$Command, $OutputDefinition>`) — kitz uses functional composition
- Hive uses TypeBox for schemas — kitz uses Effect v4 Schema
- Hive's output cases are manually defined — kitz's error registry (DD-15) could auto-derive failure cases from the typed error channel
- Hive's Texture.Builder is **redundant** — kitz already has strictly superior text infra (see analysis below)
- Hive's case→renderer mapping is runtime-dispatched — kitz should make it type-safe via Effect's `Match` or exhaustive mapped types

**What to steal**:
- Case-based output (success/failure variants, not just one shape)
- Upfront output spec that constrains the handler's return type (the input+output symmetry Oak lacked)
- Schema-discoverable output contracts (`--show-output-schema`)
- Runtime validation that command output matches declared schema
- Structured text builder (not just string concatenation)
- Error-as-output (failures are structured data, not just exit codes)
- Snapshot testing patterns for CLI output

**What to fix (that Hive couldn't)**:
- **Type-safe case→renderer dispatch**. Hive's `runTextBuilder` takes `CaseDefinition` (base) + `Result` (base) — the per-case type narrowing is lost. This happened because:
  - TypeBox composite schemas require `as any` to construct, severing the type link
  - The case is matched via `.find()` on a runtime discriminant, not via type narrowing
  - The `TextBuilder<$Data = any>` default erases the data type at the dispatch site

  In kitz, Effect Schema's `TaggedClass` + `Match.tagsExhaustive` (or a mapped type) can solve this structurally:
  ```typescript
  // The renderer record is a mapped type over the output union
  type Renderers<Output extends { _tag: string }> = {
    [K in Output['_tag']]: (data: Extract<Output, { _tag: K }>) => string
  }
  // TypeScript enforces: every case covered, each renderer gets its specific type
  // No runtime .find(), no `as any`, no type erasure at dispatch
  ```
  This is possible because Effect Schema TaggedClass gives us discriminated unions with `_tag` that TypeScript can narrow, unlike TypeBox's composite schemas which required `as any` escape hatches.

**Hive's Texture.Builder vs kitz text infra** [T19]:

Hive's `Texture.Builder` is a mutable chainable builder (`.line()`, `.columns()`, `.header()`, `.indent()`, `.success()`, `.failure()`) using string concatenation and the `colors` npm package. kitz already has strictly superior infrastructure:

| Capability | Hive Texture | kitz |
|---|---|---|
| Box model | None | `@kitz/tex` Tex.Box — full CSS-like model with logical properties, orientation-aware axes |
| Table/columns | Basic cell padding | `Str.Visual.Table` — ANSI-aware column widths, row/column-oriented input |
| ANSI handling | Broken (padding doesn't account for escape codes) | `Str.Visual` — grapheme-cluster-aware width, correct ANSI padding |
| Text wrapping | None | `Str.Visual.wrap()` — word-aware with hyphenation strategies |
| Borders | None | Full partial borders with corners, hooks for dynamic styling |
| Percentage sizing | None | Bigint-based (`50n` = 50% of parent) |
| Performance | String concatenation | Array joins (more efficient) |
| Nested composition | Limited (builder within builder) | Full (boxes contain boxes) |

**Verdict**: Hive's Texture.Builder would be redundant in kitz. The text renderer in the output codec system should use `@kitz/tex` and `Str.Visual.Table` directly. The only things Hive has that kitz doesn't are convenience status methods (`.success()`, `.failure()`) — trivially composable with `ansis` + existing infra.

This also informs OQ-08 (Str.Box perf): the _capabilities_ are not in question — kitz has what's needed. The open question is purely about startup time cost of importing `@kitz/tex`. Lazy-loading it (only when `--help` or text output is needed) may be sufficient regardless of runtime perf.

---

## Cross-Cutting Analysis

### Feature Matrix

| Feature | kitz/cli | kitz/oak | Clef | @effect/cli | oclif |
|---------|----------|----------|------|-------------|-------|
| Command routing | File-based (1 level) | None | Hierarchical + lazy catalog | Declarative tree | File/explicit/single |
| Arg parsing (flags) | Token-level only | Full (schema) | Full (Zod) | Full (own DSL) | Full (class statics) |
| Positional args | None | None | None | Full | Full |
| Schema integration | None | Standard Schema V1 | Zod only | Effect Schema | Custom flag types |
| Help generation | None | Yes (from schema) | Yes (two-column, sync) | Yes (HelpDoc AST) | Yes (customizable) |
| Shell completions | None | None | bash/fish/zsh + auto-refresh | bash/fish/zsh/sh | bash/zsh (plugin) |
| Interactive prompts | None | Event-driven | Selection only | Rich (12 types) | External (inquirer) |
| Env var fallback | None | Prefix-based | None | Via Config | Via flag `env` prop |
| Config file fallback | None | None | None | JSON/YAML/INI/TOML | Via plugin |
| Effect integration | Full | Partial (prompts) | Minimal (Array/String) | Full | None |
| Plugin system | None | None | None | None | First-class |
| Hook lifecycle | None | None | None | None | Full |
| JSON output mode | None | None | None | None | Built-in |
| Wizard mode | None | None | None | Built-in | None |
| Manifest/digest cache | None | None | SHA-256 + version digest | None | Full manifest |
| Type-level analysis | Arg/Param | Builder state | 5 type-level test files | Via inference | Via static props |
| Theming | None | None | None | None | theme.json |
| Execution metadata | None | None | `ConfiguredClef<T>` | None | None |
| Two-tier lazy loading | None | None | exec vs metadata paths | None | None |
| Built-in commands | None | None | completions print/install/path | --help/--wizard/--completions | --help/--version |
| Local bin management | None | None | Shell hooks (bash/fish/zsh) | None | None |
| Module interop | None | None | tsx/CJS normalization | None | None |
| Script discovery | None | None | Dir scan + humanized names | None | Filesystem patterns |
| Typed error registry | None | None | None | None | PrettyPrintableError (untyped) |
| Exit code mapping | None | None | None | None | Configurable per error type |
| Error documentation | None | None | None | ValidationError variants | Per-error suggestions |

### Architectural Patterns Worth Stealing

| Pattern | Source | Why |
|---------|--------|-----|
| Schema as source of truth | Oak | One schema → parsing + help + validation + prompts |
| Standard Schema V1 abstraction | Oak | Schema-library agnostic (Zod, Effect Schema, etc.) |
| CommandCatalog with lazy namespaces | Clef | First-class aggregate; large CLIs don't pay upfront cost |
| Two-tier lazy expansion (exec vs metadata) | Clef | Help/completions use cheap `loadMetadata`; execution loads full module |
| Three-way command resolution | Clef | Exact → namespace → longest-prefix is intuitive |
| Fallback chain: flag → config → env → prompt | @effect/cli | Best resolution strategy |
| Command IS an Effect | @effect/cli | Composability with Effect ecosystem |
| Hook lifecycle | oclif | Cross-cutting concerns (telemetry, auth, etc.) |
| SHA-256 + version digest for completions | Clef | Auto-refresh without manual build step; version bumps on format changes |
| JSON output mode | oclif | Machine-readable output toggle |
| File-based command routing | kitz/cli | Zero-config command discovery |
| Compile-time arg analysis | kitz/cli | Type-level validation mirrors runtime |
| Event-driven prompting | Oak | Prompt on parse failure, not as separate step |
| `ConfiguredClef<TExecution>` pattern | Clef | App-level DI metadata flows through entire command tree, type-constrained |
| `ExecutionTarget` discriminated union | Clef | Clean `{kind: 'command'} \| {kind: 'script'}` dispatch |
| Two execution surfaces | Clef | Commands (persistent) vs Scripts (one-off/discoverable) |
| Flexible taxonomy | oclif | `config set` and `set config` both resolve |
| Built-in commands injected into catalog | Clef | `completions print/install/path` merged via `buildAugmentedCommandCatalog()` |
| Atomic completion writes | Clef | temp file + rename prevents partial reads |
| Script discovery with humanized names | Clef | `describeScriptName()` turns `deploy.staging.rollback` into readable help |
| Module interop normalization | Clef | `normalizeModuleNamespace()` handles tsx/CJS double-wrapping |
| `InferGlobalFlags<TSpecs>` | Clef | Derive flag types from spec objects, no manual annotation |

### Anti-Patterns to Avoid

| Anti-Pattern | Source | Why |
|--------------|--------|-----|
| Class-based commands + manual parse | oclif | Types flow indirectly, boilerplate in every command |
| Inheritance for sharing | oclif | Rigid hierarchies, no functional composition |
| Own DSL for args/options | @effect/cli | Locks out existing schemas (Zod, Effect Schema) |
| Flags-only (no positionals) | Oak, Clef | Many CLIs need `<source> <dest>` patterns |
| Global prompt config | Oak | Should be per-parameter |
| Upfront loading of all commands | @effect/cli | Doesn't scale for large CLIs |
| Manifest as required build step | oclif | Footgun — should be automatic/optional |
| Strict = false losing all validation | oclif | Variadic should still validate |

---

## Design Decisions

### DD-01: Effect v4 Schema Only — No Standard Schema V1

~~Every command handler returns an `Effect`. Arguments are defined via schemas (Standard Schema V1 or Effect Schema).~~

**Resolved**: Effect v4 is out with major Schema changes. Effect Schema is the only target for kitz going forward. Drop Standard Schema V1 and Zod support. This simplifies internals, enables richer metadata extraction, and aligns with the broader kitz ecosystem. [Resolves OQ-01] [T06]

The schema is the single source of truth for:
- Type inference
- Argument parsing
- Help text generation
- Validation
- Interactive prompts
- Shell completion values
- Custom domain types (file paths via `@kitz/path`, etc.) [T05]

### DD-02: Composable Building Blocks, Not a Monolith

Commands are values, not classes. Composition via `pipe()`, not inheritance. Sharing via layers and middleware functions, not base classes. [T01] [T13]

**Core principle**: Every piece decomposes into reusable bits AND composes upward into a turnkey framework. Classic FP — the framework is the composition of its parts, not a container you plug into.

This means:
- Token parsing (arg/param) is usable standalone without the command system
- The parsing engine is usable without the dispatch/routing system
- Help generation is usable without the full framework
- Completions generation is usable without the full framework
- Each piece is a pure function or Effect, not framework-coupled

The full turnkey experience (`Cli.run(app)`) is just the composition of these pieces.

```typescript
// Aspiration:
const deploy = Command.make('deploy')
  .args({ target: Args.string(), env: Args.enum(['staging', 'prod']) })
  .flags({ force: Flag.boolean().alias('f'), dryRun: Flag.boolean().alias('n') })
  .handler(({ target, env, force, dryRun }) =>
    Effect.gen(function*() { ... })
  )
```

### DD-03: Lazy-First Command Tree

Commands load on demand. The framework only loads the command being executed. Metadata for help/completions is either:
- Derived from lightweight descriptors (no handler import needed)
- Cached in a manifest that auto-refreshes (Clef's digest approach, not oclif's manual build step)

### DD-04: Resolution Strategy

Three-way resolution (from Clef):
1. **Exact match** — argv maps to a complete command path
2. **Namespace** — argv is a prefix of multiple commands → show sub-help
3. **Longest prefix** — deepest matching command, remaining args passed through

Plus auto-correct suggestions (from @effect/cli) when no match is found.

### DD-05: Fallback Chain

For every parameter, resolution follows (from @effect/cli, extended):
1. **Command line flag/arg** — explicit argv
2. **Environment variable** — with configurable prefix
3. **Config file** — JSON/YAML/TOML
4. **Interactive prompt** — if TTY available
5. **Default value** — from schema
6. **Error** — required and unresolved

### DD-06: Output Is Data + Codec, Not Strings [T16]

~~Every command can opt into `--json` mode (from oclif).~~

**Revised**: JSON is not a mode you opt into — it's the _default representation_. Every command output is structured data first. Text rendering is a codec applied to that data. `--json` doesn't "enable" anything — it just skips the text codec.

**Core model**: A command returns `Effect<Output, E, R>` where `Output` is a typed value. The framework applies a _codec_ to render it:

```typescript
// The output is always data. The codec decides how to present it.
const deploy = Cli.Command.make('deploy', { ... }, handler).pipe(
  Cli.Command.output(DeployResult, {
    text: (result) => `Deployed ${result.service} to ${result.env} (${result.version})`,
    // json is free — just JSON.stringify(Schema.encode(result))
  })
)
```

**Codec as a pluggable/swappable layer**:

```typescript
// Define a reusable output codec
const TableCodec = Cli.Output.codec({
  text: (rows, schema) => Cli.Output.table(rows, { columns: Schema.fields(schema) }),
  json: (rows, schema) => Schema.encode(S.Array(schema))(rows),
  csv:  (rows, schema) => Cli.Output.csv(rows, { headers: Schema.fields(schema) }),
})

// Swap codecs without changing command logic
const listUsers = Cli.Command.make('list', { ... }, handler).pipe(
  Cli.Command.output(UserSchema, TableCodec),
)

// Custom codec for a specific domain
const DiffCodec = Cli.Output.codec({
  text: (diff) => Cli.Output.patch(diff),    // unified diff format
  json: (diff) => diff,                       // raw structured diff
})
```

**Schema codecs as the mechanism**: Effect Schema's encode/decode duality maps perfectly. The _output schema_ defines the data shape. Codecs are encode functions targeting different formats. The schema's annotations (field descriptions, examples) feed the text renderer automatically.

**What `--json` actually does**: It's not a feature — it's the absence of a text codec. The framework serializes the output schema's encoded form. This means `--json` output is always schema-valid, always typed, always consistent.

**What `--format` enables**: Beyond json/text, codecs can register additional formats. `--format csv`, `--format yaml`, `--format table` — each is a codec registered on the command. The framework validates that the requested format has a codec.

**Case-based output, not single-return** (from Hive Console prior art [T18]):

A command's output is not a single shape — it's a discriminated union of cases. Each case (success variant, failure variant) has its own schema and its own text renderer. This unifies with DD-15's error registry: failure cases come from the typed error channel, success cases come from the handler's return type.

```typescript
// The output definition IS the union of success + failure cases.
// Unlike Hive, the case→renderer mapping is TYPE-SAFE:
// each renderer receives exactly the data type of its case.

// Success output schema (what the handler returns)
class Deployed extends S.TaggedClass<Deployed>()('Deployed', {
  service: S.String,
  version: S.String,
  env: S.Literal('staging', 'production'),
}) {}

class DryRun extends S.TaggedClass<DryRun>()('DryRun', {
  plan: S.Array(S.String),
}) {}

const deploy = Cli.Command.make('deploy', { ... }, handler).pipe(
  // Output spec constrains handler return type (Hive's key insight)
  // AND provides type-safe case→renderer mapping (Hive's gap, fixed)
  Cli.Command.output({
    Deployed: {
      text: (r: Deployed) => `Deployed ${r.service}@${r.version} → ${r.env}`,
    },
    DryRun: {
      text: (r: DryRun) => r.plan.map(s => `  would: ${s}`).join('\n'),
    },
    // Failure renderers auto-derived from error registry (DD-15)
    // Missing a case? TypeScript error.
    // Wrong data type in renderer? TypeScript error.
  })
)
```

**How kitz solves what Hive couldn't**: The output record is a mapped type `{ [K in Output['_tag']]: { text: (data: Extract<Output, { _tag: K }>) => string } }`. TypeScript enforces exhaustiveness (every case covered) and correctness (each renderer receives its specific case type). This is possible because:
1. Effect's `TaggedClass` provides discriminated unions with `_tag`
2. Effect's `Match.tagsExhaustive` or a simple mapped type can express the constraint
3. The handler's return type is `Effect<Deployed | DryRun, Errors, R>` — the union is visible in the type system

The **input + output symmetry** that Oak lacked: Oak spec'd the input (argv → typed args) but not the output. kitz/cli spec's both ends — the output schema constrains the handler's return type just like the input schema constrains the args.

**Output schema discoverability**: `my-cli deploy --show-output-schema` prints the JSON Schema for all output cases. This makes the CLI's data contract machine-parseable — useful for scripting, documentation generation, and testing.

**Implications**:
- `log()`/`warn()` in `--json` mode are suppressed (they're text-codec artifacts)
- Errors are also data — the error registry (DD-15) provides the error schema, codecs render it
- Progress/status output is a separate stream from the result codec
- Piping (`my-cli list | my-cli process`) works because `--json` gives structured data
- Snapshot testing: output schemas enable deterministic test assertions on CLI output structure

### DD-07: Hook Lifecycle

Lifecycle hooks for cross-cutting concerns (from oclif, simplified):
- `init` — before command resolution
- `preparse` — before argument parsing
- `prerun` — after parsing, before handler
- `postrun` — after handler
- `error` — on unhandled error
- `command_not_found` — resolution failed
- Custom hooks via string keys

### DD-08: Shell Completions Built In

bash/fish/zsh completions generated from command tree + parameter schemas. Auto-refresh via content digest (from Clef), not manual manifest generation. [T03]

This is a gap kitz has never addressed. Both @effect/cli and Clef solved it. Clef's approach (digest-based auto-refresh, built-in install commands) is more mature than @effect/cli's (print-only).

### DD-09: Bun-First, Multi-Runtime Secondary

Bun is the primary target runtime. Node.js and other runtimes are supported but secondary — when tradeoffs arise, optimize for Bun. [T07]

This affects:
- Module loading strategy (Bun's native TS execution)
- Process spawning APIs
- File system access patterns
- Startup time characteristics

### DD-10: Startup Time Is Sacred [T08] [T20]

CLI startup time is a first-order design constraint. Every import, every module load, every initialization step must justify its existence.

**What probably costs time** (needs benchmarking to confirm ranking):

1. **Import graph resolution** (unbundled) — each `import` is a filesystem stat + read + parse. Likely a significant cost when the transitive import graph is large. If the framework eagerly imports help rendering, completion generation, prompt UI, and every codec just to run `my-cli deploy`, that's probably wasted work.
2. **Module evaluation** — code that runs at top-level scope (class statics, regex compilation, `const x = expensiveInit()`). Effect Schema class declarations may have some of this — needs measurement.
3. **Parse time** (bundled) — a single bundled file eliminates resolution cost but parse time presumably scales with code size.

**⚠ None of the above ordering has been benchmarked in Bun.** The relative costs could be different from Node.js intuitions.

**Implications** (assuming the model above holds):
- Lazy loading (`await import()`) for everything not on the hot path: help, completions, prompts, codecs, `@kitz/tex`
- The framework's top-level import should be minimal — just enough for dispatch + parse + run
- Tree-shakeable module structure (no barrel files that force loading everything)
- Measure startup time in CI — regression = failure

**Bundling as a deployment strategy**: `bun build --target=bun` collapses the import graph to one file. For production CLIs, the framework should support (and maybe recommend) bundling. This shifts the cost from "graph resolution" to "parse time" — whether that's actually cheaper needs benchmarking. The framework's module structure should be bundle-friendly (no dynamic `require`, no `__dirname` tricks).

### DD-11: Thin CLI Package, Fat Kitz Ecosystem

The CLI package itself should be thin. Most of the "framework" is actually other kitz packages doing their jobs. [T11] [T13]

- Argument parsing → builds on `@kitz/core` (Schema, errors, string utils)
- File path arguments → `@kitz/path` (already has AbsDir, RelFile, etc.)
- Help text layout → `@kitz/tex` (text formatting) — but see OQ-08 on perf
- Output formatting → `@kitz/core` Str.Builder
- Program entry → existing `Cli.run` pattern
- Error formatting → `@kitz/core` Err infrastructure

The CLI package's job is to _compose_ these, not _reimplment_ them.

### DD-12: Custom Schema Types via Kitz Ecosystem

Effect Schema custom types from the kitz ecosystem should be first-class CLI parameter types. [T05]

Examples:
- `@kitz/path` → `Fs.Path.RelFile`, `Fs.Path.AbsDir`, etc. → CLI knows to offer path completion
- `@kitz/semver` → `SemVer` schema → CLI validates semver syntax
- `@kitz/url` → `Url` schema → CLI validates URL format

The CLI framework recognizes these types and enhances help text, validation messages, and shell completions accordingly. This is kitz's answer to @effect/cli's `Args.file()` / `Options.directory()` — but driven by the schema, not by CLI-specific constructors.

### DD-13: Project-Local CLI Pattern

Support the "I have a project-local CLI" use case that Clef addresses. [T04]

This means:
- A project can define commands in a directory, get a CLI with zero config
- Shell hooks can add project-local bin to PATH automatically
- The framework supports discovery + dispatch for project-scoped tools
- Works for monorepo tooling, project scripts, developer utilities

### DD-14: API-Spec-Driven CLI Generation

Support generating a CLI from an API specification — "automatic CLI for your app." [T12]

Clef shows this pattern: given a structured API (service layer, module exports, etc.), generate a command tree that maps 1:1. This enables:
- Testing: API tests drive CLI tests and vice versa
- E2E: CLI invocations become integration test surface
- Consistency: API and CLI stay in sync automatically
- The CLI becomes a view of the API, not a separate artifact

### DD-15: Typed Error Registry with Exit Code Mapping [T14]

Effect makes errors visible in the type system. kitz/cli should leverage this: every error that can bubble up to the program top must be _registered_, and that registry becomes the source of truth for exit codes, help output error documentation, and `--json` error shapes.

**Approach**: Runtime feature enforced by type inference (not a codegen step).

```typescript
// Draft concept:
const app = Cli.Command.make('deploy', { ... }, handler).pipe(
  Cli.Command.errors({
    ConfigNotFound:   { code: 10, doc: 'No config file found. Run `deploy init` first.' },
    AuthExpired:      { code: 11, doc: 'Auth token expired. Run `deploy login`.' },
    NetworkTimeout:   { code: 12, doc: 'Request timed out. Check connectivity.' },
  })
)
```

**How type inference enforces completeness**: The handler's `Effect<A, E, R>` exposes `E` as a union. The `errors()` combinator requires a record whose keys cover every tag in `E`. If the handler can fail with `ConfigNotFound | AuthExpired | NetworkTimeout` but the registry only maps two of them, TypeScript reports a type error. No generator needed — the compiler _is_ the enforcement.

**What the registry provides**:
- **Exit codes**: Each error tag maps to a specific non-zero exit code (not just `1` for everything)
- **Help output**: `my-cli --help-errors` or a section in `--help` listing all possible errors with docs
- **JSON mode**: Structured error responses include `code`, `tag`, `message`, `doc`
- **Suggestions**: Each error can include `suggestions: string[]` for recovery guidance
- **Composability**: Subcommand error registries compose upward — parent sees union of all child errors

**Why runtime over codegen**:
- No build step to forget
- Types are always in sync (the compiler enforces it)
- Works with Effect's error channel naturally
- Codegen would require parsing `.d.ts` output — fragile and runtime-disconnected

**The 10% codegen case**: Could be useful for generating static documentation (man pages, website error reference) from the registry. But the registry itself is runtime-first.

### DD-16: Daemon/Long-Running Process Primitives → `@kitz/daemon` [T15] [T17]

Three jasonkuhrt CLIs (bookmarks, madmod, flo) independently implement daemon/watch patterns. These primitives belong in their own package — `@kitz/daemon` — not inside `@kitz/cli`. Daemon is a proper noun → own package. The CLI framework _consumes_ `@kitz/daemon` for the convenience layer (e.g., generating `start`/`stop`/`status` subcommands), but the primitives themselves are CLI-independent.

**`@kitz/daemon` provides** (composable building blocks, each independently useful):

1. **PID file management** — acquire, check, release with stale detection
   ```typescript
   import { Daemon } from '@kitz/daemon'
   const pid = Daemon.acquirePid({ path: '/tmp/my-app.pid' })
   // Returns Effect<PidLock, PidAlreadyRunning | PidStale, Scope>
   // Automatically released when Scope finalizes
   ```

2. **Health check endpoint** — lightweight IPC
   ```typescript
   Daemon.healthServer({ socketPath: '/tmp/my-app.sock' })
   Daemon.healthCheck({ socketPath: '/tmp/my-app.sock' })
   ```

3. **Graceful shutdown** — SIGTERM/SIGINT handling with drain period
   ```typescript
   Daemon.withGracefulShutdown({ drainMs: 5000 })(myLongRunningEffect)
   ```

4. **File watching with debounce** — wraps Bun's native watcher or `@parcel/watcher`
   ```typescript
   Daemon.watch({
     paths: ['./src'],
     ignore: ['**/*.test.ts'],
     debounceMs: 100,
   }) // Returns Stream<FileChangeEvent>
   ```

**`@kitz/cli` provides** (the CLI integration layer, depends on `@kitz/daemon`):

5. **Standard daemon subcommands** — generated from a daemon descriptor
   ```typescript
   const daemon = Daemon.define({
     name: 'my-watcher',
     pidPath: '/tmp/my-watcher.pid',
     socketPath: '/tmp/my-watcher.sock',
     run: myWatcherEffect,
   })
   // Generates: my-cli daemon start/stop/status/restart
   Cli.Command.withDaemon(daemon)
   ```

**Out of scope for both**:
- Process supervision (use systemd/launchd)
- Clustering/multi-process orchestration
- Log rotation (use OS tools)
- Auto-restart on crash (use supervisor)

**Integration with Effect's resource model**: PID locks use `Scope` for automatic cleanup. Health servers use `Layer` for lifecycle. File watchers are `Stream`s. Graceful shutdown uses `Effect.addFinalizer`. These are native Effect patterns, not daemon-specific abstractions.

---

## Constraints & Strategic Direction

### Competitive Positioning [T09]

The Rust (clap, dialoguer) and Go (cobra, bubbletea, gum) CLI ecosystems are excellent. What does kitz contribute that justifies existing in TypeScript?

**Not competing on**:
- Raw startup speed (Rust/Go compile to native code)
- Binary distribution (Rust/Go compile to single binary)
- System-level CLI tools (use Rust/Go)

**Potential advantages** (claims below need verification against current Rust/Go ecosystem):
- **Effect ecosystem integration** — typed errors, dependency injection, resource management, concurrency. Likely unique to kitz but needs survey of Rust/Go CLI frameworks to confirm
- **Schema-driven everything** — one schema → parsing + help + completions + prompts + validation. Rust's clap uses derive macros which may be comparable — needs comparison
- **TypeScript developer experience** — for teams already in TS, switching to Rust/Go for CLI tooling is a context switch. kitz makes TS CLIs as good as they can be
- **API-spec-driven generation** — bridge from your TS service layer to a CLI automatically
- **Typed error registry** — every CLI error has an exit code, documentation, and recovery suggestions, enforced by the type system. Whether Rust/Go frameworks offer something comparable at the type level is unverified
- **Decomposable building blocks** — use just the parser, just the completions, just the help renderer. Not all-or-nothing
- **Project-local tooling** — developer scripts, monorepo tools, workspace CLIs where Rust/Go is overkill

**Target audience**: TS teams building internal tools, developer CLIs, monorepo tooling, and project-local utilities. Not system utilities competing with coreutils.

### Runtime Budget [T08] [T10]

**No real targets yet** — need to benchmark before setting numbers. The following are placeholders that need to be grounded in actual measurement:
- Cold start (first command): TBD — benchmark Bun with realistic import graph first
- Help rendering: TBD
- Completion generation: TBD

If `@kitz/tex` Str.Box is measurably slow for help rendering, don't use it. See OQ-08.

### Startup Time: Distributed vs Repo-Local CLIs [T21]

**Two fundamentally different deployment contexts with different startup profiles:**

**Distributed CLIs** (published, installed globally):
- Bundle aggressively at ship time (`bun build`, esbuild)
- Don't compromise dev-time lego-bit decomposition for startup perf
- The optimization point is the bundler output, not the source architecture
- This is a solved problem

**Repo-local CLIs** (project tools, dev scripts, Clef-style):
- Run unbundled — Bun executes TS directly from source
- Import graph resolution is the dominant startup cost
- **These change frequently** — if the CLI is an API entrypoint and the API changes multiple times a week, any cache approach faces high churn
- Cold starts are common by nature

**The caching question**: Could we transparently bundle repo-local CLIs as a cache?
- **Change detection cost**: Checking mtimes/hashes on N files at startup _could_ cost more than just loading them — but this is speculative, needs measurement
- **Cache churn**: Frequent source changes likely mean the cache is cold often
- **Correctness**: Stale cache = wrong behavior. For a dev tool, this is worse than being slow
- **DX bar**: If a developer ever thinks "is my CLI cache stale?" the cache has failed

**Current stance**: Don't build a cache system until benchmarks prove it's needed. The framework's lazy loading (DD-03, DD-10) already minimizes what gets loaded per invocation.

**Benchmark first**: Measure `bun run` with a realistic import graph on target hardware. We have no data on Bun's actual TS execution overhead for this use case — the answer should come from measurement, not intuition.

---

## Architecture Proposal

### Package Structure [T02] [T11] [T13]

**Revised: Single package `@kitz/cli`** — absorb Oak's parsing engine, retire the Oak package name.

Oak's identity problem: it's a "CLI argument parser" that doesn't route commands, doesn't generate completions, and lives in a separate package from the actual CLI infrastructure. The name "Oak" doesn't communicate its purpose. The right move is to absorb its parsing engine into `@kitz/cli` and let the name die. [Resolves OQ-05 → option (a)]

```
packages/cli/
  src/
    arg/          # Token-level parsing (existing, keep)
    param/        # Flag name parsing (existing, keep)
    command/      # Command definition + builder (new)
    parse/        # Schema-driven argument parsing (from Oak, rewritten for Effect v4 Schema)
    catalog/      # Command catalog + lazy namespaces (from Clef patterns)
    resolve/      # Three-way command resolution (from Clef patterns)
    completion/   # Shell completion generation (new, from Clef patterns)
    help/         # Help text generation (rewrite — NOT Str.Box, see OQ-08)
    hook/         # Hook lifecycle (new, from oclif patterns)
    prompt/       # Interactive prompts (from Oak, evolved)
    run/          # Program entry point (existing, keep)
    output/       # JSON mode, structured output, codec system (new)
    local/        # Project-local CLI support (from Clef patterns)
```

This is one package with clear internal modules, but each module is designed to be independently useful (DD-02). The package re-exports composed convenience APIs at the top level.

### Command Definition API (Draft)

```typescript
import { Cli } from 'kitz'

// Simple command
const greet = Cli.Command.make('greet', {
  args: {
    name: Cli.Arg.string().describe('Who to greet'),
  },
  flags: {
    loud: Cli.Flag.boolean().alias('l').describe('SHOUT the greeting'),
  },
}, ({ name, loud }) =>
  Effect.sync(() => {
    const msg = `Hello, ${name}!`
    console.log(loud ? msg.toUpperCase() : msg)
  })
)

// Command with subcommands
const app = Cli.Command.make('my-cli', {
  description: 'My awesome CLI',
  version: '1.0.0',
}).pipe(
  Cli.Command.withSubcommands([greet, deploy, config]),
)

// Run
app.pipe(
  Cli.run({
    json: true,
    completions: true,
  })
)
```

### Schema Integration (Draft) [T05] [T06]

Effect v4 Schema only. No Zod, no Standard Schema V1.

```typescript
// Effect v4 Schema — the only schema system
const args = {
  port: Cli.Arg.schema(S.Int.pipe(S.between(1, 65535))),
  host: Cli.Arg.schema(S.String.pipe(S.pattern(/^[\w.-]+$/))),
}

// Kitz ecosystem schemas — first-class CLI types
const args = {
  source: Cli.Arg.schema(Fs.Path.RelFile),     // tab-completes files
  output: Cli.Arg.schema(Fs.Path.AbsDir),      // tab-completes dirs
  version: Cli.Arg.schema(SemVer.Schema),       // validates semver
  endpoint: Cli.Arg.schema(Url.Schema),         // validates URL
}
```

The framework inspects Effect Schema annotations/AST to determine:
- Help text (description, examples, refinements)
- Completion behavior (enum values, file paths, etc.)
- Prompt type (text, select, confirm based on schema shape)
- Validation error messages

### Output Codec System (Draft) [T16]

```typescript
import { Cli, S } from 'kitz'

// 1. Define output schema
const DeployResult = S.Struct({
  service: S.String,
  env: S.Literal('staging', 'production'),
  version: S.String,
  duration: S.Number.pipe(S.annotations({ description: 'Deployment time in seconds' })),
  healthy: S.Boolean,
})

// 2. Simple text codec — just a render function
const deploy = Cli.Command.make('deploy', { ... }, handler).pipe(
  Cli.Command.output(DeployResult, {
    text: (r) => `✓ ${r.service}@${r.version} → ${r.env} (${r.duration}s)`,
  })
)
// --json: {"service":"api","env":"production","version":"1.2.3","duration":4.2,"healthy":true}
// (no flag): ✓ api@1.2.3 → production (4.2s)

// 3. Table codec for list commands — schema fields become columns
const UserSchema = S.Struct({
  name: S.String,
  email: S.String,
  role: S.Literal('admin', 'user', 'viewer'),
  active: S.Boolean,
})

const listUsers = Cli.Command.make('list', { ... }, handler).pipe(
  Cli.Command.output(S.Array(UserSchema), Cli.Output.table()),
)
// --json: [{"name":"alice",...},...]
// (no flag):
//   NAME    EMAIL              ROLE    ACTIVE
//   alice   alice@co.com       admin   true
//   bob     bob@co.com         user    false

// 4. Custom codec with multiple formats
const AuditCodec = Cli.Output.codec('audit', {
  text:  (entries) => entries.map(e => `[${e.level}] ${e.message}`).join('\n'),
  json:  (entries) => entries,  // identity — schema handles encoding
  csv:   (entries) => Cli.Output.csv(entries),
  yaml:  (entries) => Cli.Output.yaml(entries),
})

// 5. Swap codecs at the call site
const audit = Cli.Command.make('audit', { ... }, handler).pipe(
  Cli.Command.output(AuditEntrySchema, AuditCodec),
)
// my-cli audit                → text rendering
// my-cli audit --json         → JSON
// my-cli audit --format csv   → CSV
// my-cli audit --format yaml  → YAML

// 6. Streaming output — codec applies per chunk
const watch = Cli.Command.make('watch', { ... }, handler).pipe(
  Cli.Command.outputStream(ChangeEventSchema, {
    text: (event) => `${event.type} ${event.path}`,
  })
)
// Each event rendered independently as it arrives
```

### Fallback Chain (Draft)

```typescript
const port = Cli.Flag.schema(S.Int)
  .alias('p')
  .env('PORT')                    // 2. env var
  .config('server.port')          // 3. config file key
  .prompt(Cli.Prompt.integer({    // 4. interactive
    message: 'Server port?',
    min: 1, max: 65535,
  }))
  .default(3000)                  // 5. default
```

---

## Open Questions

### ~~OQ-01: Standard Schema V1 vs Effect Schema Only?~~ RESOLVED

**Decision**: Effect v4 Schema only. See DD-01. [T06]

### OQ-02: File-Based vs Declarative Command Trees?

kitz/cli and Clef use file-based routing. @effect/cli uses declarative trees. Which is primary?

**Arguments for file-based**: Zero-config, scales naturally, lazy loading is free.
**Arguments for declarative**: Explicit, type-safe, testable, portable.
**Possible answer**: Support both. Declarative as primary API, file-based as a convenience layer on top.

### OQ-03: How Deep Does the Plugin System Go?

oclif's plugin system is powerful but heavy. Do we need:
- (a) No plugin system (commands are just modules)
- (b) Lightweight discovery (scan directories, merge command trees)
- (c) Full plugin lifecycle (install, load, hook, manifest)

### OQ-04: Positional Args — How?

None of the kitz/jasonkuhrt inputs support positional args. @effect/cli and oclif do. Design question:
- Separate `args` (positional) from `flags` (named)?
- Or unified with position inferred from schema key order?
- How do variadics work? (`cli <files...>`)

### ~~OQ-05: What Happens to @kitz/oak?~~ RESOLVED

**Decision**: Absorb into `@kitz/cli`. Oak's parsing engine gets rewritten for Effect v4 Schema and merged into `@kitz/cli`'s `parse/` module. The `@kitz/oak` package is retired. See Architecture Proposal. [T02]

### ~~OQ-06: Daemon/Watch Mode Infrastructure?~~ RESOLVED → Yes, in scope

**Decision**: Include daemon affordances in the CLI framework. [T15]

bookmarks, madmod, and flo all implement daemon/watch modes independently. This is a pattern that recurs enough to warrant framework support. See DD-16.

### ~~OQ-07: Output Formatting Layer?~~ RESOLVED → Data + Codec model

**Decision**: Yes, first-class output layer. Not "include tables/spinners" but a deeper rethink: output is always structured data, codecs render it. See DD-06 (revised). [T16]

The answer is neither "include everything" nor "defer to @kitz/tex" — it's "output is data, codecs are pluggable, the framework provides json/text/table codecs, users can add more."

### OQ-13: Output Codec Design Details [T16]

The data + codec model (DD-06) raises several design questions:

- **Streaming output**: Commands that produce output incrementally (e.g., `watch`, `tail`, `stream`) can't wait for the full result. Does the codec model work with `Stream<Output>` as well as `Effect<Output>`? Each chunk needs codec application independently.
- **Side-channel output**: Progress bars, spinners, status messages, `log()`/`warn()` — these are _not_ the command result. They're a side channel. In `--json` mode they're suppressed. How does the framework distinguish result output from side-channel output?
  - Candidate: `Cli.Output.emit(data)` for result stream, `Cli.Output.status(msg)` for side-channel. The codec only applies to `emit`.
- **Codec discovery**: When a user passes `--format csv`, how does the framework know if the command supports CSV? Options:
  - (a) Codecs register format names, framework validates at parse time
  - (b) Framework always accepts `--format`, codec handles unknown formats with an error
  - (c) Available formats appear in `--help`
- **Schema-derived text rendering**: Can the schema's field annotations generate _reasonable_ default text output without a custom text codec? e.g., a record of `{ name: string, age: number, active: boolean }` could auto-render as a key-value list or table row. Would save boilerplate for simple commands.
- **Composing codecs across subcommands**: If `list` outputs `User[]` with `TableCodec` and `show` outputs `User` with a detail codec, does the parent command need to know about these? Or are codecs fully encapsulated per command?
- **Where do built-in codecs live?**: In `@kitz/cli`'s `output/` module? Or in `@kitz/tex`? The table renderer, CSV renderer, etc. need to exist somewhere. The DD-11 "thin package" principle suggests these are separate, but the DD-02 "composable but turnkey" principle wants them available out of the box.
  - Candidate: `@kitz/cli` includes json + simple text. `@kitz/cli-codecs` or `@kitz/tex` provides table, csv, yaml, diff, etc. The framework re-exports common ones for convenience.

### OQ-08: Str.Box Performance for Help Rendering [T10]

`@kitz/tex` Str.Box is currently used for Oak's help output. Suspected to have poor performance. Options:
- (a) **Benchmark first** — maybe it's fine and the suspicion is wrong
- (b) **Optimize Str.Box** — fix the perf issues, benefit all consumers
- (c) **Ditch Str.Box for help** — use a simple, fast, purpose-built help renderer (just string concatenation with padding)
- (d) **Lazy-load Str.Box** — only import it when `--help` is actually requested, so it never impacts startup time

Startup time constraint (DD-10) makes this urgent. Even if Str.Box is fast enough once loaded, its import cost matters. Help rendering is rare (user requests it explicitly), so lazy loading might be sufficient regardless of runtime perf.

### OQ-09: Competitive Differentiation vs Rust/Go [T09]

Is the positioning in the Constraints section sufficient? Or does kitz need specific features that Rust/Go CLI ecosystems can't match?

Candidates for unique value (unverified — need to survey Rust/Go ecosystems):
- API-spec-driven CLI generation (DD-14) — likely no Rust/Go framework does this, but unconfirmed
- Effect's typed error channels — CLI errors are composable, not just strings
- Schema-driven everything — one definition, six outputs
- Project-local CLIs running TS directly via Bun

### OQ-10: How Does API-Spec-Driven Generation Work? [T12]

Clef bridges from API specs to CLIs. What does this look like in kitz?

Options:
- (a) **Convention**: export an Effect service → framework generates commands from service methods
- (b) **Explicit**: `Cli.fromService(MyService)` generates a command tree
- (c) **Schema-driven**: define input/output schemas → framework generates arg parsing + output formatting
- (d) **Bidirectional testing**: CLI invocations map to service calls, enabling shared test suites

This is potentially the most differentiating feature. It means "your CLI is a view of your API" — not a separately maintained artifact. Changes to the service automatically flow to the CLI.

### OQ-11: Implementation Approach — Incremental or Clean Slate? [T01] [T02]

Given that Oak is being absorbed and rewritten for Effect v4 Schema, and existing `@kitz/cli` has solid token-level parsing:

- (a) **Keep `arg/`, `param/`, `run/`** from current `@kitz/cli` — they're solid
- (b) **Rewrite `parse/`** from scratch targeting Effect v4 Schema (don't port Oak's Standard Schema V1 plumbing)
- (c) **Port Clef patterns** for catalog/resolution/completions, converting from Zod to Effect Schema
- (d) **New modules** for command builder, hooks, output, local CLI support

This is incremental on the foundation but clean-slate on the higher layers.

### OQ-12: Error Registry Type Inference Design [T14]

The typed error registry (DD-15) needs to solve several type-level problems:

- **Extracting error tags from `Effect<A, E, R>`**: Need `E` to be a union of tagged errors. Effect's `Data.TaggedError` and kitz's `Err.TaggedContextualError` both provide `_tag`. How do we constrain `E` to only tagged errors?
- **Exhaustiveness checking**: The record passed to `errors()` must have a key for every member of `E`. This is `{ [K in E['_tag']]: ErrorConfig }` — standard mapped type, should work.
- **Subcommand composition**: When `withSubcommands` merges error channels, the parent's registry must cover the union. Do subcommands register their own errors, and the parent inherits? Or does the parent re-register everything?
- **Framework errors vs user errors**: Parse failures, missing args, unknown flags — these are framework errors with pre-assigned exit codes. Only user-domain errors need registration. How to distinguish?
- **Exit code uniqueness**: Should the framework enforce unique exit codes across the registry? Or allow overlap?
- **Partial registry**: Should unregistered errors fall back to a generic exit code (1) with a warning, or should incomplete coverage be a hard type error?

Leaning toward: hard type error for exhaustiveness, framework errors handled separately, subcommands register their own errors and parents inherit automatically.

---

## Session Log

### Session 1 — 2026-03-12

**Work done**:
- Launched 6 parallel research agents to analyze all inputs
- Analyzed: @kitz/cli, @kitz/oak, Clef, 8 jasonkuhrt CLIs, @effect/cli, oclif
- Created this brainstorm document with:
  - Full input summaries
  - Feature matrix comparison
  - Patterns to steal / anti-patterns to avoid
  - 8 design decisions (DD-01 through DD-08)
  - Architecture proposal with API drafts
  - 7 open questions (OQ-01 through OQ-07)

**Key insights**:
- No single input has it all — kitz needs to synthesize the best of each
- The "schema as source of truth" pattern (from Oak) combined with "command is an Effect" (from @effect/cli) is the core architectural thesis
- Clef's routing/resolution model is the most sophisticated — steal the three-way resolution and lazy namespaces
- oclif's full-lifecycle approach (hooks, plugins, JSON mode, theming) provides the ambition target
- The jasonkuhrt CLI inventory confirms: a framework is badly needed (60% hand-written parsers)

**Next steps identified**:
- Resolve open questions (especially OQ-01, OQ-02, OQ-05)
- Draft detailed type signatures for the Command/Arg/Flag APIs
- Decide on package structure
- Identify what can be kept from existing @kitz/cli and @kitz/oak code vs rewritten
- Create an implementation plan with phases

**Update 1 (same session)**: Refreshed Clef analysis after significant updates. Clef has matured substantially:
- Promoted from app-embedded to shared library (41 files, up from 20)
- New `CommandCatalog` system with lazy namespaces and two-tier expansion
- Full shell completions (bash/fish/zsh) with SHA-256 versioned digest auto-refresh
- `ConfiguredClef<TExecution>` typed execution metadata pattern
- `ExecutionTarget` discriminated union
- Built-in commands (`completions print/install/path`) injected into catalog
- Local bin management with shell hooks
- Module interop normalization (tsx/CJS)
- `InferGlobalFlags<TSpecs>` type inference from spec objects
- 5 type-level test files (up from 1)
- Updated brainstorm doc: feature matrix expanded (+7 rows), patterns-to-steal table expanded (+7 entries)

**Update 2 (same session)**: Integrated 13 strategic considerations from user (see Raw Thoughts Index T01–T13). Major changes:
- **Resolved OQ-01**: Effect v4 Schema only — no Standard Schema V1, no Zod
- **Resolved OQ-05**: Absorb Oak into `@kitz/cli`, retire the Oak package name
- **Added 6 new design decisions**: DD-09 (Bun-first), DD-10 (startup time sacred), DD-11 (thin package), DD-12 (custom schema types), DD-13 (project-local CLI), DD-14 (API-spec-driven CLI)
- **Added Constraints & Strategic Direction section**: competitive positioning vs Rust/Go, runtime budget targets
- **Added 4 new open questions**: OQ-08 (Str.Box perf), OQ-09 (competitive differentiation), OQ-10 (API-spec generation design), OQ-11 (implementation approach)
- **Updated architecture proposal**: single package, Oak absorbed, module layout revised

**Update 3 (2026-03-13)**: Integrated typed error registry idea [T14] and daemon affordances [T15].
- **Added DD-15**: Typed Error Registry with Exit Code Mapping — runtime-first, enforced by type inference
- **Added OQ-12**: Error registry type-level design questions (exhaustiveness, composition, framework vs user errors)
- **Updated Competitive Positioning**: typed error registry as differentiator
- **Updated Feature Matrix**: +3 rows (typed error registry, exit code mapping, error documentation)
- Sketched API draft showing `Cli.Command.errors()` combinator with mapped type exhaustiveness
- **Resolved OQ-06**: Daemon/watch mode is in scope
- **Added DD-16**: Daemon/Long-Running Process Affordances — composable Effect primitives for PID, health, watch, graceful shutdown
- **Updated architecture**: added `daemon/` module to package layout
- **Revised DD-06**: From "opt-in JSON mode" to "output is data + codec" — JSON is default, text is a codec, codecs are pluggable/swappable
- **Resolved OQ-07**: Output formatting layer → data + codec model
- **Added OQ-13**: Output codec design details (streaming, side-channel, discovery, schema-derived defaults)
- **Added Output Codec System draft**: API sketches for text/table/custom/streaming codecs
- T16–T19 integrated
- **Revised DD-16**: Daemon primitives → `@kitz/daemon` (own package), CLI only provides the subcommand generation layer on top
- **Removed `daemon/`** from `@kitz/cli` package layout
- **Saved feedback memory**: proper-noun → package rule for all future kitz work
- **Applied proper-noun rule retro-check**: Completion, Prompt, Hook could arguably be their own packages too — but they're more "CLI sub-concepts" than independent proper nouns. The CLI framework _is_ the composition of these. Daemon is different because PID management, file watching, health checks are useful outside CLI contexts entirely (e.g., an Effect service that happens to run as a daemon but has no CLI).
- **Added Input #7**: Hive Console CLI output system (jasonkuhrt's prior art, PR graphql-hive/console#6344)
- **Updated DD-06**: Integrated case-based output pattern from Hive — output is a discriminated union of success/failure cases, not a single shape. Each case has its own schema and text renderer. Unifies with DD-15 error registry.
- **Added `--show-output-schema` discoverability** to DD-06
- T18 integrated

---

## Raw Thoughts Index

Lossless index of user-provided considerations, with traceability tags used throughout the document.

| Tag | Raw Thought | Integrated Into |
|-----|-------------|-----------------|
| T01 | Building blocks that compose upward to a full turnkey framework but decompose into bits too, classic FP principals | DD-02, OQ-11 |
| T02 | How to reconcile cli vs oak — keep one, neither, both, rename, remix | OQ-05 (resolved), Architecture Proposal |
| T03 | Kitz never addressed the completions story; effect cli and clef did | DD-08 |
| T04 | Clef tackled the problem of "I have a project-local CLI" | DD-13 |
| T05 | Oak was going toward custom schema types that don't make sense in vanilla Zod (file types); kitz/path now allows spec'ing rel/abs/dir/file params | DD-01, DD-12, Schema Integration draft |
| T06 | Effect v4 is out with major changes to Effect Schema; only target for kitz going forward | DD-01 (resolved OQ-01), Schema Integration draft |
| T07 | Generally targeting Bun, other runtimes secondary when tradeoffs arise | DD-09 |
| T08 | CLI startup time is super important | DD-10, Runtime Budget |
| T09 | Great CLI ecosystems exist in Rust and Go (e.g. gum) — what does kitz contribute competitively? | Competitive Positioning, OQ-09 |
| T10 | Kitz has things like Str.Box currently used for Oak help output; perf is suspected to be bad — ditch it or fix it | OQ-08 |
| T11 | Kitz CLI should be pretty thin because so much support comes from other kitz bits (general pure FP utils, etc.) | DD-11 |
| T12 | Clef has the concept of bridging from an API spec automatically; "automatic CLI for your app" that ties into testing (API driving CLI + E2E tests) | DD-14, OQ-10 |
| T13 | Broader point about decomposed CLI bits leveraging general kitz bits (pure FP utils, etc.) in impl | DD-02, DD-11 |
| T14 | Effect makes errors visible in the type system; CLI should have an error index — either codegen from tsc reflection on types, or (90% preferred) a runtime registry enforced by type inference that maps errors to exit codes and docs; registry is also where you write error documentation | DD-15, OQ-12, Competitive Positioning |
| T15 | Daemon feature affordances for CLI — yes, in scope | DD-16, OQ-06 (resolved) |
| T16 | CLI should have first-class output formatting: JSON as base feature, every output has textual renderer + data, explore via schema codecs, pluggable/modular codec swapping for output control without reinventing primitives | DD-06 (revised), OQ-07 (resolved), OQ-13, Output Codec draft |
| T17 | Daemon primitives do NOT belong in @kitz/cli. Kitz rule: every proper noun/concept → its own package. Concept without a package = new package by default. To do otherwise requires explicit statement. Kitz is a growing lego-like kit. | DD-16 (revised), Architecture Proposal (revised), feedback memory saved |
| T18 | Prior art: jasonkuhrt designed generic text/json output system for The Guild's Hive Console CLI (oclif-based). PR graphql-hive/console#6344. Case-based output definition, schema-discoverable contracts, structured text builder, error-as-output. Different impl (oclif classes, TypeBox) but concepts transfer. Didn't have type-safe union output → rendering mapping. Did have upfront output spec forcing type-safe handler returns (which Oak never had). | Input #7 summary, DD-06 (case-based output), patterns-to-steal |
| T19 | Hive PR also had a Texture.Builder for text rendering — compare with kitz infra to see if it's better or not | Input #7 (Texture comparison), OQ-08 |
| T20 | CLI startup cost — is it bundle size? Not exactly. Unbundled: import graph resolution (file count/depth). Bundled: parse time (correlates with size). Bun-first means consider `bun build` as deployment strategy. | DD-10 (revised) |
