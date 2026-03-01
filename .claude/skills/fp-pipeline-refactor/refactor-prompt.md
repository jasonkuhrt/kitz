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
