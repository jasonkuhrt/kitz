---
name: fp-pipeline-refactor
description: Refactor imperative TypeScript to Effect-first pipeline composition using curried data-first/data-last APIs, Effect collections, and schema-based IO boundaries.
---

# FP Pipeline Refactor

Use this skill when code needs to move from imperative style to Effect + kitz functional composition.

## Goals

- Prefer pipeline-friendly composition over statement-by-statement mutation.
- Use Effect-native data structures:
  - `HashMap` / `HashSet`
  - mutable variants only when profiling proves they are needed.
- Remove untyped boundaries:
  - avoid `JSON.parse`
  - avoid `try/catch`
  - avoid `Promise` orchestration
  - avoid `any` and type assertions
- Bridge untyped IO with `Schema` decode/encode at boundaries.

## Repeatable Refactor Flow

1. Identify imperative hotspots.
2. Normalize data flow into pure transforms and `Effect.gen` orchestration.
3. Replace native `Map`/`Set` with Effect `HashMap`/`HashSet` where the module is already in Effect context.
4. Replace `JSON.parse` with `Schema.decodeUnknown*` and explicit schema models.
5. Replace `try/catch` with `Effect.try`, `Effect.tryPromise`, `Either`, `Option`, and typed error channels.
6. Replace promise chains with `Effect` combinators (`Effect.all`, `Effect.forEach`, `Effect.promise`, `Effect.async`).
7. Remove `any` and assertions (`as`, `<T>`) by introducing schema/constructor functions at boundaries.
8. Run lint/tests and keep behavior stable.

## Refactor Prompt Template

```md
Refactor this module to Effect-first functional composition.

Constraints:
- Use pipeline-friendly, curried composition patterns.
- Prefer Effect data structures (`HashMap`/`HashSet`; mutable variants only if necessary).
- No `JSON.parse` (use Effect Schema decode/encode codecs).
- No `try/catch` (use `Effect.try`, `Either`, `Option`, typed errors).
- No Promise orchestration (use Effect combinators only).
- No `any`, no assertion casts; rely on inference + schema at IO boundaries.

Deliverables:
1. Updated implementation.
2. Updated tests proving behavior unchanged.
3. Short notes listing removed anti-patterns and replacement patterns.
```
