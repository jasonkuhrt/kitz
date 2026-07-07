# Contributing — @kitz/effect

## Key Decisions

| Decision                                                                                                                             | Why                                                                                                                                             | Alternative rejected                                                                       | Link                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Path ops follow a three-tier arity rule: unary → leaf instance getter, n-ary → flat `Fn.dual` function, union classes → pure schemas | 8 of 15 operations were polymorphic/mixed-domain; any type-namespace filing needed a per-op judgment call                                       | Pipe-subject (Effect module idiom) filing; everything-flat                                 | [spec](../../docs/superpowers/specs/2026-07-05-path-organizing-principle-design.md) |
| Leading-`..` count field is named `ascent`                                                                                           | No ecosystem-standard noun exists; `back` reads as navigation history and doesn't scan as a count; scalar noun can't be misread as an operation | `up` (verb-ish, double-names the parent axis), `parentSteps`, keeping `back`               | [spec](../../docs/superpowers/specs/2026-07-05-path-organizing-principle-design.md) |
| Honest `.name` types: file → `string`, dir → `Option<Segment>`                                                                       | The old `''` fallback conflated root with empty-name                                                                                            | Uniform `Option` (always-`Some` wrapper for files)                                         | [spec](../../docs/superpowers/specs/2026-07-05-path-organizing-principle-design.md) |
| Unions pipe through `S.toTaggedUnion('_tag')` for `cases`/`guards`/`isAnyOf`/`match`                                                 | Structure-derived schema utilities; codec unchanged; restores exhaustive dispatch after Match-based statics moved to getters                    | `S.TaggedUnion` proper (builds members from field sets; can't wrap existing codec classes) | [spec](../../docs/superpowers/specs/2026-07-05-path-organizing-principle-design.md) |
| `isSameSegments` deleted                                                                                                             | Compared only `ascent`+`segments` (a file always "equalled" its own dir); zero call sites; structural `Equal.equals` covers real equality       | Keeping it as a public op                                                                  | [spec](../../docs/superpowers/specs/2026-07-05-path-organizing-principle-design.md) |
| Test arbitraries live at the `@kitz/effect/Path/Testing` subpath, off the main entry                                                 | Production consumers must not eagerly derive fast-check arbitraries or load `effect/testing`; mirrors effect's own `/testing` split             | Exporting `Testing` from the production barrel                                             | [report §8](../../docs/superpowers/reports/2026-07-06-path-pre-merge-analysis.md)   |
| Framework-coupled test matchers live in `@kitz/vitest` (peer-depends on `@kitz/effect`; dev edge points back)                        | Full vitest matcher context (isNot, utils.diff) needs vitest typing; published graphs stay acyclic; mirrors `effect` vs `@effect/vitest`        | Context-free matchers inside `Path/Testing`                                                | [report §8](../../docs/superpowers/reports/2026-07-06-path-pre-merge-analysis.md)   |
| Flat path operations live in `path/operations/`, one file each                                                                       | "Operation" is the domain term used across spec, report, and history; `operators/` was the lone outlier                                         | Keeping `operators/`                                                                       | [spec](../../docs/superpowers/specs/2026-07-05-path-organizing-principle-design.md) |
| Tests are organized by feature in one `_.test.ts`; type + value assertions co-locate per feature block                               | One feature → one test locus; build-time vs run-time is an assertion mechanism, not an organizing axis; delete feature = delete one block       | Mechanism-split files (`types.test.ts`, `codec.test.ts`, …)                                | [report §5](../../docs/superpowers/reports/2026-07-06-path-pre-merge-analysis.md)   |

## Working on the path module

- The organizing principle above governs where every new operation lives; the
  spec is the authoritative statement.
- The string boundary is `path/analyzer.ts` (plus `core/fileUrl.ts` for
  `file://` URLs) — nothing else interprets or renders path strings.
- Open decisions are tracked in the pre-merge report (e.g. `Segment` branding,
  union JSON Schema emission, Tier-3 literal `Input` polymorphism).

## Detail records

Full rationale lives in the session documents linked above; promote entries to
`docs/rationales/NNNN-*.md` files as they stabilize.
