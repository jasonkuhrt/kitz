# Effect v4 Upgrade PR Session

## Requirement: Preserve `.make()` — No `new` for Schema Classes

**Rule**: All `Schema.Class` and `Schema.TaggedClass` instances MUST use `.make()` for construction. `new ClassName(...)` is NOT acceptable.

**Implementation**:
- Every Schema.Class and TaggedClass definition has `static make = this.makeUnsafe` added (135 classes across 61 files)
- All call sites use `X.make({...})` instead of `new X({...})`
- Only exception: standalone factory functions (`export const make = (args) => new XClass(args)`) in fs path modules — these ARE the public `.make()` API and use `new` internally

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

## Other changes in this session

- **`sch/union.ts`**: Changed `memberSchema.make()` to `memberSchema.makeUnsafe()` (generic schema call, not class construction)
- **GitHub Issue #131**: Created for follow-up migration to v4 native `TaggedUnion`/`toTaggedUnion`
- **Migration memory updated**: `project_effect_v4_migration.md` reflects current state

## Validation

| Check | Status |
|-------|--------|
| `bun run check:types` | All 30 packages pass |
| `bun run test:packages` | All tests pass (347 release + 19 github) |
| `verify-no-new-schema-classes.sh` | PASS |
| CI (commit `609e7887`) | Pushed, watching |
