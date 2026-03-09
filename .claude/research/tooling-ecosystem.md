# Kitz Tooling Ecosystem Research

> Research date: 2026-02-28
> Purpose: Map the tooling landscape that kitz could leverage to become a dominant developer experience library.

## Table of Contents

1. [Editor Extensions (VSCode, Zed)](#1-editor-extensions-vscode-zed)
2. [LSP Extensions & TypeScript Plugins](#2-lsp-extensions--typescript-plugins)
3. [MCP (Model Context Protocol) Servers](#3-mcp-model-context-protocol-servers)
4. [Rolldown Plugins](#4-rolldown-plugins)
5. [OxLint Plugins](#5-oxlint-plugins)
6. [Prior Art Analysis](#6-prior-art-analysis)
7. [Strategic Sequencing](#7-strategic-sequencing)

---

## 1. Editor Extensions (VSCode, Zed)

### VSCode Extension API

VSCode extensions can provide [programmatic language features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features) either directly through the Extension API or via a Language Server (LSP). The direct API surface includes:

**Features beyond what raw LSP provides:**

- **Decorations**: Rich text decorations, background colors, gutters, custom rendering in the editor. No LSP equivalent.
- **WebViews**: Full HTML/JS panels embedded in VSCode for custom UIs (dashboards, visualizers, interactive documentation).
- **Tree Views**: Custom sidebar panels (like the file explorer) for displaying hierarchical data.
- **Commands & Keybindings**: Custom editor commands accessible from the command palette.
- **StatusBar Items**: Persistent status indicators.
- **Task Providers**: Integration with VSCode's task running system.
- **Debug Adapters**: Custom debugging protocols.
- **Authentication Providers**: OAuth flows, token management.
- **Custom Editors**: Full custom editor implementations for specific file types.

**LSP-compatible features (available via extension API or LSP):**

- `registerCompletionItemProvider` — custom completions with trigger characters
- `registerCodeActionsProvider` — quick fixes, refactors
- `registerCodeLensProvider` — actionable annotations inline with code
- `registerInlayHintsProvider` — parameter names, type annotations inline
- `registerHoverProvider` — hover information
- `registerDiagnosticProvider` — custom errors/warnings
- `registerDefinitionProvider` — go-to-definition
- `registerRenameProvider` — cross-file rename

**Key insight**: An extension can operate as a thin client wrapping an LSP server (portable to all editors) while also providing VSCode-specific enhancements (decorations, webviews, tree views) that have no LSP equivalent.

### Zed Extension API

Zed uses a [WASM-based extension system](https://zed.dev/blog/zed-decoded-extensions). Extensions are Rust code compiled to `wasm32-wasip1` and executed via Wasmtime.

**Architecture:**

- Write Rust code implementing the `zed::Extension` trait from `zed_extension_api`
- Compile to WASM
- Zed downloads, unpacks, and runs the module in a sandbox
- WIT (WebAssembly Interface Types) + `wit_bindgen` handle type conversion between WASM and host

**Current capabilities:**

- Language support (grammars, language servers)
- Themes and icon themes
- Debugger integration
- Slash commands (for Zed's AI assistant)
- MCP server integration
- Language server lifecycle management (`language_server_command`, initialization options, workspace configuration)
- Completion and symbol label providers

**What Zed extensions CANNOT yet do:**

- Custom UI panels (planned but not yet available)
- Arbitrary editor decorations
- Custom webviews

**Key insight**: Zed's extension model is narrower than VSCode's but highly performant. The most practical path for kitz in Zed is to ship an LSP server that Zed extensions can wrap, plus contribute Zed-specific features as they become available.

### Opportunities for Kitz

| Opportunity                                | VSCode              | Zed                | Feasibility |
| ------------------------------------------ | ------------------- | ------------------ | ----------- |
| Custom completions for kitz patterns       | Yes (LSP or direct) | Yes (via LSP)      | Easy        |
| Inlay hints showing Effect types           | Yes (LSP or direct) | Yes (via LSP)      | Medium      |
| CodeLens for service dependencies          | Yes                 | Partial (LSP only) | Medium      |
| WebView for dependency graph visualization | Yes                 | No (not yet)       | Hard        |
| Tree view for Effect service registry      | Yes                 | No (not yet)       | Medium      |
| Custom diagnostics for kitz anti-patterns  | Yes (LSP or direct) | Yes (via LSP)      | Medium      |

**References:**

- [VSCode Extension API](https://code.visualstudio.com/api/references/vscode-api)
- [VSCode Programmatic Language Features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features)
- [VSCode Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- [Zed Extension Architecture (blog)](https://zed.dev/blog/zed-decoded-extensions)
- [Zed Extension Trait docs.rs](https://docs.rs/zed_extension_api/latest/zed_extension_api/trait.Extension.html)
- [BAML: How to write a Zed extension](https://boundaryml.com/blog/how-to-write-a-zed-extension-for-a-made-up-language)
- [Zed Extensions GitHub](https://github.com/zed-industries/extensions)

---

## 2. LSP Extensions & TypeScript Plugins

### TypeScript Language Service Plugin API (Strada / tsserver)

TypeScript supports [language service plugins](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin) configured via `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@kitz/language-service" }]
  }
}
```

**Architecture:** Plugins use the Decorator Pattern to wrap the TypeScript Language Service. They receive the existing service and return a new one that intercepts/augments calls.

**Wrappable methods:**

- `getCompletionsAtPosition` — add/remove/modify completions
- `getSemanticDiagnostics` — add custom warnings/errors in the editor
- `getSuggestionDiagnostics` — suggest refactors proactively
- `getQuickInfoAtPosition` — enrich hover information
- `getApplicableRefactors` / `getEditsForRefactor` — add custom refactoring operations
- `getCodeFixesAtPosition` — add custom quick fixes
- `getDefinitionAtPosition` — override go-to-definition behavior

**Critical limitations:**

- Plugins affect the **editor only**, not `tsc` builds. They cannot add new type-checking rules that fail compilation.
- Plugins cannot change syntax or add new language features.
- Plugins do NOT work in VSCode's built-in TS server without the user explicitly enabling them (some require a VSCode extension to set `typescript.tsserver.pluginPaths`).

**Effect's approach** (workaround for tsc limitation): The `@effect/language-service` package includes a `patch` command that modifies the TypeScript library itself to include diagnostics during `tsc` builds. This is invasive but effective.

### tsgo / TypeScript 7 (Project Corsa) — Plugin Status

**The critical question: Will tsgo support plugins?**

As of the [December 2025 progress update](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/):

- The **Corsa API is still a work in progress**. No stable tooling integration exists.
- TypeScript 7.0 **will NOT support the existing Strada API** (the current `typescript` npm package's API surface).
- The existing language service plugin mechanism **will not work** with tsgo.
- The recommended workaround is running both `typescript` (<=6.0) and `@typescript/native-preview` side-by-side.
- TypeScript 7 uses **standard LSP protocol** instead of the custom TSServer protocol.
- Shared-memory parallelism is being leveraged in the rearchitected language service.
- Summer 2026 is the speculative target for Corsa's stable release.

**Implications for kitz:**

1. Any TS language service plugin built today targets the Strada API and works with TS <=6.0 only.
2. For tsgo/TS7, the path forward is likely a **standalone LSP server** rather than a TS plugin, since tsgo speaks standard LSP.
3. The move to standard LSP is actually _good_ for kitz — a standalone LSP server would work with tsgo, VSCode, Zed, Neovim, and any LSP client.
4. Effect's `@effect/language-service` will face the same transition pressure.

### Standalone LSP Server Approach

Rather than embedding in TypeScript's language service, kitz could ship its own LSP server that:

- Communicates with TypeScript (via tsserver or tsgo) for type information
- Adds kitz-specific intelligence on top
- Is editor-agnostic (works everywhere LSP is supported)

This is the approach taken by [Tailwind CSS IntelliSense](https://github.com/tailwindlabs/tailwindcss-intellisense), [Prisma Language Tools](https://github.com/prisma/language-tools), and [Volar/Vue Language Tools](https://github.com/vuejs/language-tools).

### Opportunities for Kitz

| Opportunity                      | TS Plugin (Strada) | Standalone LSP | Feasibility |
| -------------------------------- | ------------------ | -------------- | ----------- |
| Custom completions for kitz APIs | Yes                | Yes            | Easy        |
| Diagnostics for anti-patterns    | Yes (editor only)  | Yes            | Medium      |
| Diagnostics during build (tsc)   | Via patch hack     | N/A            | Hard        |
| Rich hover info for kitz types   | Yes                | Yes            | Medium      |
| Refactors (e.g., pipe <-> gen)   | Yes                | Yes            | Medium      |
| Works with tsgo/TS7              | No                 | Yes            | N/A         |
| Works across all editors         | Limited            | Yes            | N/A         |

**Recommendation:** Start with a TS language service plugin (fast to build, leverages existing Effect plugin patterns) but architect it as a standalone service from day one, so migration to a full LSP server is straightforward when tsgo arrives.

**References:**

- [Writing a TS Language Service Plugin (Wiki)](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin)
- [Sample TS Plugin](https://github.com/RyanCavanaugh/sample-ts-plugin)
- [TS Plugin Diagnostics Guide](https://www.nieknijland.nl/blog/how-to-write-a-diagnostics-typescript-language-service-plugin)
- [Effect Language Service](https://github.com/Effect-TS/language-service)
- [TypeScript 7 December 2025 Progress](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [TypeScript Native Port Announcement](https://devblogs.microsoft.com/typescript/typescript-native-port/)

---

## 3. MCP (Model Context Protocol) Servers

### What is MCP?

[MCP](https://modelcontextprotocol.io/) is an open standard (introduced by Anthropic, November 2024; adopted by OpenAI, March 2025) for connecting AI assistants to external tools and data. It's the de facto standard for agent-tool integration. The [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) provides first-class support.

### MCP Primitives

MCP servers expose three types of capabilities:

1. **Tools** — Functions the LLM can call (computation, side effects, network). Think: "check this type", "generate a service scaffold", "explain this error".
2. **Resources** — Read-only data the client can surface. Think: "list all services in this project", "show the dependency graph", "get the API surface of a module".
3. **Prompts** — Reusable templates for consistent LLM interaction. Think: "debug this Effect error", "review this service implementation".

### Existing Precedent

- **[OpenAPI Schema Explorer MCP](https://github.com/kadykov/mcp-openapi-schema-explorer)** — Token-efficient access to API specs via parameterized URI templates.
- **[Effect Docs MCP](https://github.com/Effect-TS/language-service)** — Effect already has documentation search accessible via MCP (the `effect-docs` MCP used in this very project).
- **No existing "Effect type explorer" MCP server exists.** This is a greenfield opportunity.

### What Kitz Could Expose via MCP

**Tools:**

- `kitz:type-check` — Run type checking against a specific module or service definition, return structured diagnostics.
- `kitz:scaffold-service` — Generate service boilerplate from a description (name, dependencies, methods).
- `kitz:scaffold-module` — Generate a kitz module with correct barrel exports, test file, etc.
- `kitz:explain-error` — Parse a kitz/Effect type error and produce a human-readable explanation with fix suggestions.
- `kitz:lint` — Run kitz-specific lint rules and return structured results.
- `kitz:pipe-to-gen` / `kitz:gen-to-pipe` — Refactor between Effect programming styles.

**Resources:**

- `kitz://services` — List all services defined in the project.
- `kitz://services/{name}` — Get detailed type information for a specific service (dependencies, provided APIs, error types).
- `kitz://layers` — List all layers and their service provision graph.
- `kitz://modules` — List kitz modules with their public API surface.
- `kitz://modules/{name}/api` — Get the public API of a specific module (exported types, functions, their signatures).
- `kitz://errors` — Enumerate all custom error types in the project.

**Prompts:**

- `kitz:debug-effect` — A template for debugging a failing Effect, pre-loaded with project context.
- `kitz:review-service` — A template for reviewing a service implementation against kitz best practices.
- `kitz:migration-guide` — Help migrate from one version of kitz to another.

### Implementation Architecture

```
kitz MCP Server
├── TypeScript SDK (@modelcontextprotocol/sdk)
├── Effect runtime (for internal operations)
├── TypeScript Compiler API (for type introspection)
│   └── Reads tsconfig.json, resolves project files
├── Tool handlers
│   ├── scaffold-service → generates code using kitz templates
│   ├── explain-error → parses TS diagnostics, maps to kitz patterns
│   └── lint → runs kitz-specific checks
├── Resource providers
│   ├── services → scans project for Effect.Service/Context.Tag
│   ├── layers → resolves Layer composition graph
│   └── modules → parses barrel exports
└── Transport: stdio (CLI) or Streamable HTTP (remote)
```

### Feasibility & Impact

| Aspect                    | Assessment                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Implementation complexity | Medium — TypeScript SDK makes server scaffolding trivial; type introspection is the hard part |
| User value                | Very High — AI agents with deep kitz knowledge can dramatically accelerate development        |
| Competitive advantage     | High — No other Effect/TS utility library offers this                                         |
| Maintenance cost          | Medium — Must track kitz API changes                                                          |

**References:**

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Specification](https://modelcontextprotocol.io/)
- [OpenAPI Schema Explorer MCP](https://github.com/kadykov/mcp-openapi-schema-explorer)
- [Building MCP Servers (freeCodeCamp)](https://www.freecodecamp.org/news/how-to-build-a-custom-mcp-server-with-typescript-a-handbook-for-developers/)

---

## 4. Rolldown Plugins

### Rolldown Plugin API

[Rolldown](https://rolldown.rs/) is a Rust-based bundler with a [Rollup-compatible plugin API](https://rolldown.rs/apis/plugin-api). As of early 2026, Rolldown 1.0 RC is released and powers Vite 8 Beta. The API is considered stable.

**Available plugin hooks (Build phase):**

- `options` — process/modify configuration
- `buildStart` — initialization
- `resolveId` — custom module resolution (virtual modules, aliases)
- `load` — provide source code for resolved modules
- `transform` — modify source code before bundling (sequential execution)
- `moduleParsed` — notification after parsing
- `resolveDynamicImport` — handle dynamic imports
- `buildEnd` — finalization

**Available plugin hooks (Output phase):**

- `renderStart`, `renderChunk` — modify output chunks
- `generateBundle` — inspect/modify the final bundle
- `writeBundle` — post-write side effects
- `banner`/`footer`/`intro`/`outro` — inject wrapper code

**Performance feature: [Hook Filters](https://rolldown.rs/apis/plugin-api/hook-filters)**
Rolldown evaluates filter conditions on the Rust side before calling into JS, avoiding expensive Rust-to-JS IPC for irrelevant files. The `transform` hook supports filtering by `id` (file path glob), `moduleType`, and `code` (content pattern).

### What Kitz Could Do with Rolldown/Vite Plugins

**1. Dead Code Elimination Hints (Easy)**
A plugin that annotates kitz module exports with `/*#__PURE__*/` comments to improve tree-shaking. Many Effect patterns (service constructors, Layer compositions) are function calls that bundlers conservatively keep. A kitz plugin could mark known-pure constructions.

```typescript
// kitz-rolldown-plugin
export function kitzPlugin(): Plugin {
  return {
    name: 'kitz',
    transform: {
      filter: { id: /\.ts$/ },
      handler(code, id) {
        // Add #__PURE__ annotations to known-pure kitz patterns
        // e.g., Effect.service(...), Layer.provide(...)
      },
    },
  }
}
```

**2. Virtual Module for Runtime Configuration (Easy)**
Provide a `virtual:kitz/config` module that inlines build-time configuration:

```typescript
// User code
import { config } from 'virtual:kitz/config'

// Plugin resolves to build-time constants
// Enables dead code elimination of unused features
```

**3. Compile-Time Schema Validation (Medium)**
A transform that validates schema definitions at build time and strips runtime validation code for production builds where inputs are trusted:

```typescript
// transform hook
// Detect Schema.Struct definitions, validate at build time
// Optionally replace with no-op validators in production
```

**4. Service Dependency Graph Generation (Medium)**
A `generateBundle` hook that produces a `kitz-services.json` manifest of all services, their dependencies, and layers. Useful for documentation, monitoring dashboards, and deployment validation.

**5. Import Analysis & Optimization (Hard)**
Analyze kitz imports and rewrite barrel imports to direct module imports for better tree-shaking:

```typescript
// Before (barrel import, pulls in entire module)
import { Array, Option, pipe } from '@kitz/core'

// After (direct imports, tree-shakeable)
import { Array } from '@kitz/core/array'
import { Option } from '@kitz/core/option'
import { pipe } from '@kitz/core/pipe'
```

### Feasibility

| Plugin                       | Complexity | Impact     | Priority                       |
| ---------------------------- | ---------- | ---------- | ------------------------------ |
| Pure annotation helper       | Easy       | Medium     | High                           |
| Virtual config module        | Easy       | Low-Medium | Medium                         |
| Build-time schema validation | Medium     | Medium     | Low                            |
| Service dependency manifest  | Medium     | Medium     | Medium                         |
| Import path rewriting        | Hard       | High       | High (if tree-shaking is poor) |

**References:**

- [Rolldown Plugin API](https://rolldown.rs/apis/plugin-api)
- [Rolldown Plugin Interface](https://rolldown.rs/reference/interface.plugin)
- [Rolldown Hook Filters](https://rolldown.rs/apis/plugin-api/hook-filters)
- [Rolldown 1.0 RC Announcement](https://voidzero.dev/posts/announcing-rolldown-rc)
- [Vite 8 Beta (Rolldown-powered)](https://vite.dev/blog/announcing-vite8-beta)
- [Vite Plugin API](https://vite.dev/guide/api-plugin)

---

## 5. OxLint Plugins

### OxLint Plugin System

[OxLint](https://oxc.rs/docs/guide/usage/linter.html) (part of the Oxc toolchain) provides two plugin approaches:

**1. Built-in Rust rules** — Maximum performance, but requires contributing to the Oxc project.

**2. [JS Plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins)** (Preview, October 2025) — ESLint v9+ compatible API. Write rules in JavaScript, run them inside OxLint's Rust runtime. ~15x faster than ESLint even with JS plugins.

**Configuration:**

```json
{
  "jsPlugins": ["@kitz/oxlint-plugin"],
  "rules": {
    "@kitz/no-floating-effect": "error",
    "@kitz/prefer-pipe": "warn"
  }
}
```

**Standard ESLint API:**

```javascript
const rule = {
  meta: { type: 'problem', messages: { ... }, schema: [] },
  create(context) {
    return {
      CallExpression(node) {
        // Detect kitz anti-patterns
        context.report({ node, messageId: '...' })
      }
    }
  }
}
```

**OxLint-optimized API (createOnce):**

```javascript
import { eslintCompatPlugin } from '@oxlint/plugins'

const rule = {
  meta: { ... },
  createOnce(context) {
    let state
    return {
      before() { state = {} }, // Reset per-file
      CallExpression(node) { ... }
    }
  }
}
```

The `createOnce` API calls the factory once (not per-file), giving significant performance improvements. Plugins using `createOnce` remain ESLint-compatible via the `eslintCompatPlugin` wrapper.

### Type-Aware Linting

OxLint has [type-aware linting in alpha](https://oxc.rs/blog/2025-12-08-type-aware-alpha.html) (December 2025), powered by `tsgolint` — a Go binary built on tsgo's type checker. This is 10x faster than `typescript-eslint`. 43 type-aware rules are available.

**Critical note for kitz:** Type-aware rules are not yet available in the JS plugin API. Custom type-aware rules currently require contributing Rust code to the Oxc project. This is expected to change as the plugin API matures.

### What Kitz Rules Could Enforce

**Pattern enforcement (no type info needed):**

- `@kitz/no-floating-effect` — Detect `Effect.runPromise(...)` results that aren't awaited or assigned.
- `@kitz/prefer-pipe` — Suggest pipe style over nested function calls when chains exceed N depth.
- `@kitz/no-bare-throw` — Enforce using Effect error channels instead of `throw`.
- `@kitz/service-naming` — Enforce naming conventions for services, layers, and error types.
- `@kitz/require-error-tag` — Ensure custom errors have a `_tag` discriminant.
- `@kitz/no-effect-in-sync` — Warn when Effect operations appear in non-generator synchronous functions.
- `@kitz/layer-convention` — Enforce layer naming and export patterns.

**Type-aware rules (requires Oxc Rust contributions or future JS API support):**

- `@kitz/exhaustive-error-handling` — Ensure all error types in an Effect are handled.
- `@kitz/service-dependency-cycle` — Detect circular service dependencies at lint time.
- `@kitz/layer-completeness` — Verify that all required services are provided before `Effect.runPromise`.

### Feasibility

| Aspect                             | Assessment                                                              |
| ---------------------------------- | ----------------------------------------------------------------------- |
| JS plugin rules (pattern-based)    | Easy — Standard ESLint API, works today                                 |
| JS plugin rules (OxLint-optimized) | Easy — `createOnce` API straightforward                                 |
| Type-aware custom rules            | Hard — Requires Rust contribution to Oxc, or waiting for JS API support |
| Dual ESLint + OxLint compatibility | Easy — `createOnce` + `eslintCompatPlugin` handles both                 |
| IDE integration                    | Not yet — JS plugin diagnostics don't appear in editors yet (planned)   |

**References:**

- [OxLint JS Plugins Preview](https://oxc.rs/blog/2025-10-09-oxlint-js-plugins)
- [OxLint JS Plugins Docs](https://oxc.rs/docs/guide/usage/linter/js-plugins)
- [OxLint Type-Aware Alpha](https://oxc.rs/blog/2025-12-08-type-aware-alpha.html)
- [OxLint 1.0 Announcement](https://voidzero.dev/posts/announcing-oxlint-1-stable)
- [OxLint Custom Rules Discussion](https://github.com/oxc-project/oxc/discussions/6275)
- [tsgolint repo](https://github.com/oxc-project/tsgolint)

---

## 6. Prior Art Analysis

### Tailwind CSS — The Gold Standard

Tailwind ships one of the most comprehensive tooling ecosystems of any CSS/JS library:

| Component                                                                                         | What it does                                                                      |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [LSP Server](https://github.com/tailwindlabs/tailwindcss-intellisense)                            | Class completions, hover info, diagnostics. Runs as a standalone language server. |
| [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) | Wraps the LSP + adds VSCode-specific features (color decorators, class sorting).  |
| [Prettier Plugin](https://github.com/tailwindlabs/prettier-plugin-tailwindcss)                    | Automatic class sorting in templates.                                             |
| CLI                                                                                               | Build tool, JIT compilation, config generation.                                   |

**Architecture insight:** The LSP server is the core — it reads the Tailwind config, understands the class generation rules, and provides completions/diagnostics. The VSCode extension is a thin wrapper. Other editors (Neovim, Zed, Sublime) consume the LSP directly.

**Lesson for kitz:** Build the LSP server first. Editor extensions are thin wrappers.

### Prisma — Rust Core + WASM Distribution

Prisma's tooling stack:

| Component                                                                             | What it does                                                                                  |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Language Server](https://github.com/prisma/language-tools)                           | Completions, diagnostics, formatting for `.prisma` files.                                     |
| [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=Prisma.prisma) | Wraps the language server.                                                                    |
| `prisma-fmt` (Rust/WASM)                                                              | Core parsing + formatting engine, compiled to WASM for in-process execution in the extension. |
| CLI                                                                                   | Schema management, migrations, code generation.                                               |

**Architecture insight:** Prisma pushes heavy computation (parsing, formatting, static analysis) into a Rust binary compiled to WASM. The WASM module runs inside the VSCode extension process, eliminating IPC overhead. This is a pattern kitz could adopt for performance-critical analysis.

**Lesson for kitz:** If analysis is computationally expensive, consider a Rust/WASM core.

### Effect-TS — Current Tooling Story

Effect provides:

| Component                                                                 | What it does                                                                 | Maturity     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------ |
| [@effect/language-service](https://github.com/Effect-TS/language-service) | TS plugin: 40+ diagnostics, refactors, completions, hover enrichment.        | Mature       |
| VSCode/Cursor Extension                                                   | Fiber inspector, span tracer, "pause on defect" debugging, telemetry panels. | Active       |
| `tsc` patching                                                            | Monkey-patches TypeScript to include Effect diagnostics during builds.       | Hack (works) |
| DevTools (experimental)                                                   | Runtime fiber/span inspection via WebSocket, built-in tracer UI.             | Experimental |

**Key features of the Effect language service:**

- Floating Effect detection (unassigned/unyielded effects)
- Layer requirement leak detection
- Auto-complete for `Self` type parameters, duration strings, service declarations
- Refactors: async-to-Effect conversion, pipe style conversion, Layer composition ("Layer Magic")
- V3-to-V4 migration assistance
- `tsc` patch for build-time diagnostics

**Architecture insight:** Effect's plugin is a pure TS language service plugin — it wraps `getSemanticDiagnostics`, `getCompletionsAtPosition`, etc. This means it only works with the Strada API (TS <=6.0). It will break with tsgo.

**Lesson for kitz:** The Effect plugin is excellent prior art but faces the tsgo cliff. Kitz should learn from its feature set but architect for the LSP-native future.

### Volar / Vue Language Tools — Framework for Building Language Servers

[Volar](https://github.com/vuejs/language-tools) is the most architecturally interesting prior art:

| Component                | What it does                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `@volar/language-core`   | Framework for building language servers that handle embedded languages (like `.vue` files with HTML/JS/CSS). |
| `@vue/language-core`     | Vue-specific SFC parsing and virtual code generation.                                                        |
| `@vue/typescript-plugin` | TS plugin for Vue-aware type checking.                                                                       |
| VSCode Extension         | Wraps the language server.                                                                                   |
| `vue-tsc`                | CLI type checker for Vue files.                                                                              |

**Architecture insight:** Volar's core innovation is "virtual code" — it transforms `.vue` SFCs into virtual TypeScript files that TypeScript's language service can process. This allows full type checking across template expressions, script blocks, and style modules.

**Lesson for kitz:** Kitz doesn't have custom file formats, so Volar's virtual code approach isn't directly applicable. But Volar's clean separation of `language-core` (framework-agnostic) and `@vue/language-core` (Vue-specific) is a good architectural model.

### Angular, Svelte — Similar Patterns

Both Angular and Svelte ship language servers following the same pattern: custom file format parser -> virtual TypeScript generation -> TS language service integration -> LSP server -> editor extensions.

### tRPC — Pure-TypeScript DX

tRPC achieves its DX through pure TypeScript type inference — no editor extension or LSP required. Features like cross-client-server "Rename Symbol" work because the types flow through standard TypeScript.

**Lesson for kitz:** The best DX is invisible DX. If kitz's type-level design is excellent, many features "just work" through TypeScript's existing tooling. Invest in type design first, extensions second.

### Zod — Ecosystem Plugins

Zod's extended ecosystem:

- `eslint-plugin-zod` — ESLint rules for Zod schema best practices
- Editor integration through standard TypeScript (no custom LSP)
- Zod 4 reset the ecosystem page, encouraging library authors to update

**Lesson for kitz:** A focused ESLint/OxLint plugin is a high-value, low-effort way to provide tooling.

---

## 7. Strategic Sequencing

### Priority Matrix

| Phase                            | Tool                                    | Effort                 | Impact    | Notes                                                                                                       |
| -------------------------------- | --------------------------------------- | ---------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| **Phase 1: Foundation**          |                                         |                        |           |                                                                                                             |
| 1a                               | OxLint/ESLint plugin (pattern rules)    | Easy                   | High      | Dual-compatible via `createOnce`. Catches common mistakes. No build step needed by users.                   |
| 1b                               | MCP Server (resources + prompts)        | Easy-Medium            | Very High | AI-assisted development is the highest-leverage multiplier. Resources for service/layer/module exploration. |
| **Phase 2: Editor Intelligence** |                                         |                        |           |                                                                                                             |
| 2a                               | TS Language Service Plugin              | Medium                 | High      | Follow Effect's pattern. Custom completions, diagnostics, hover enrichment. Quick time-to-value.            |
| 2b                               | VSCode Extension (thin wrapper)         | Easy                   | Medium    | Wraps the TS plugin. Adds commands, status bar, maybe a tree view for services.                             |
| **Phase 3: Build Tooling**       |                                         |                        |           |                                                                                                             |
| 3a                               | Rolldown/Vite plugin (pure annotations) | Easy                   | Medium    | Tree-shaking improvement. Low effort, measurable impact.                                                    |
| 3b                               | Rolldown/Vite plugin (import rewriting) | Medium-Hard            | High      | Only if tree-shaking proves problematic with barrel exports.                                                |
| **Phase 4: Future-Proofing**     |                                         |                        |           |                                                                                                             |
| 4a                               | Standalone LSP Server                   | Hard                   | Very High | Required when tsgo arrives. Architect for this from Phase 2a.                                               |
| 4b                               | Zed Extension                           | Easy (once LSP exists) | Medium    | Thin WASM wrapper around the LSP server.                                                                    |
| 4c                               | OxLint type-aware rules (Rust)          | Hard                   | High      | When the API supports it, or via Rust contribution.                                                         |

### Phase 1 Rationale: Lint + MCP First

**OxLint/ESLint plugin first** because:

- Zero configuration burden on users (just add to linter config)
- Works today with stable APIs
- Dual ESLint/OxLint compatibility via `createOnce` + `eslintCompatPlugin`
- Catches real bugs (floating effects, missing error tags, naming violations)
- Fast feedback loop for kitz contributors (standard JS, no Rust or Go)

**MCP server first** because:

- AI-assisted development is the highest-leverage force multiplier in 2026
- No existing "Effect/kitz type explorer" MCP — greenfield opportunity
- Resources and prompts are trivially valuable (expose project structure, provide guided workflows)
- Tools can evolve to become extremely powerful (type-check, scaffold, explain errors)
- Implementation is straightforward with the TypeScript SDK
- Works with Claude Code, Cursor, Zed, and any MCP-compatible agent

### The tsgo Cliff

The transition from TS <=6.0 (Strada API) to TS 7+ (Corsa API, LSP-native) is the most significant architectural risk. Plan for it:

1. **Phase 2a**: Build the TS plugin but isolate the "intelligence" (what diagnostics to produce, what completions to offer) from the "integration" (how to hook into TS's language service).
2. **Phase 4a**: When tsgo stabilizes, migrate the integration layer to a standalone LSP server. The intelligence layer should port directly.

### Key Technical Decisions

1. **Ship as `@kitz/tooling` monorepo package** or **separate packages per tool?**
   - Recommendation: Separate packages (`@kitz/eslint-plugin`, `@kitz/mcp`, `@kitz/language-service`, `@kitz/vite-plugin`). Each has different dependency trees and release cadences.

2. **Standalone LSP vs. TS plugin?**
   - Start with TS plugin (Phase 2a) for speed. Architect the intelligence layer as a separate module. Migrate to standalone LSP (Phase 4a) when tsgo is stable.

3. **Rust/WASM for performance-critical paths?**
   - Not yet. TypeScript is sufficient for initial versions. Revisit if analysis performance becomes a bottleneck (Prisma's path).

4. **Effect-based implementation?**
   - Yes. The MCP server and lint rules should use Effect internally — this dogfoods kitz and demonstrates the library's value.

### Success Metrics

- **Phase 1**: Lint plugin catches N real bugs in kitz users' codebases. MCP server reduces time-to-first-service for new kitz users.
- **Phase 2**: TS plugin provides hover info and completions that users actively depend on. Zero-config setup via tsconfig.json.
- **Phase 3**: Measurable bundle size reduction via tree-shaking improvements.
- **Phase 4**: Seamless transition to tsgo. Editor features continue working across VSCode, Zed, Neovim.
