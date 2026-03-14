# Effect v4 Upgrade PR Session

## Requirement: Preserve `.make()` — No `new` for Schema Classes

**Rule**: All `Schema.Class` and `Schema.TaggedClass` instances MUST use `.make()` for construction. `new ClassName(...)` is NOT acceptable.

**Implementation**:
- Every Schema.Class and TaggedClass definition has `static make = this.makeUnsafe` added (135 classes across 61 files)
- All call sites use `X.make({...})` instead of `new X({...})`
- Only exception: standalone factory functions (`export const make = (args) => new XClass(args)`) in fs path modules — these ARE the public `.make()` API and use `new` internally
- `typescript/unbound-method` lint rule disabled — false positive on `static make = this.makeUnsafe` pattern (135 instances)

## Verification Script

```bash
bash tools/verify-no-new-schema-classes.sh
```

This script diffs the PR branch against `b22617f2` (pre-v4 base) and checks that no `new SchemaClass(...)` patterns exist in added lines. It covers all 135 Schema.Class/TaggedClass names across the monorepo.

### Proof of passing (run during session):

```
$ bash tools/verify-no-new-schema-classes.sh
Checking PR diff for 'new <SchemaClass>(...)' violations...
Base commit: b22617f2

PASS: No 'new <SchemaClass>(...)' violations found in PR diff.
All Schema.Class/TaggedClass construction uses .make() as required.
```

### How to run it yourself:

```bash
cd /Users/jasonkuhrt/projects/jasonkuhrt/kitz-effect-v4
bash tools/verify-no-new-schema-classes.sh
```

## CI Status — ALL GREEN

Commit `861876ce` — all 9/9 jobs pass:

| Job | Status |
|-----|--------|
| check-type | PASS |
| format | PASS |
| packages-types | PASS |
| packages-build | PASS |
| packages-test | PASS |
| packages-lint | PASS |
| api-model-style | PASS |
| publint | PASS |
| release-preview | PASS |

## Other changes in this session

- **`sch/union.ts`**: Changed `memberSchema.make()` to `memberSchema.makeUnsafe()` (generic schema call, not class construction)
- **GitHub Issue #131**: Created for follow-up migration to v4 native `TaggedUnion`/`toTaggedUnion`
- **Migration memory updated**: `project_effect_v4_migration.md` reflects current state
- **Merged main**: Picked up `packages/oxlint-rules` (PR #132), fixed v4 compat (Either→Result, Record, Union, parseJson→fromJsonString)
- **oxlint-rules**: Updated `schema-parsing-contract` rule to accept `S.Codec` (v4) alongside `S.Schema` (v3)
- **PR title**: Updated to include `oxlint-rules` scope after main merge
