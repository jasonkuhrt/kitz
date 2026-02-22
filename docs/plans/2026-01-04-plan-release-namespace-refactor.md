# Plan/Release Namespace Refactor

## Summary

Separate planning from releasing into two distinct flat namespaces with clean domain boundaries.

## Final Structure

```
api/
├── plan/
│   ├── __.ts              → flat barrel (export * from models + ops files + resource)
│   ├── resource.ts        → Resource.createSchemaResource() + PLAN_DIR, PLAN_FILE
│   ├── stable.ts          → stable()
│   ├── preview.ts         → preview()
│   ├── pr.ts              → pr()
│   ├── options.ts         → Options, PrOptions
│   ├── helpers.ts         → detectPrNumber, findLastReleaseTag
│   └── models/
│       ├── __.ts
│       ├── plan.ts        → Plan schema (file format = domain model)
│       ├── item.ts        → Item = Stable | Preview | Pr (union)
│       ├── item-stable.ts → Stable class (tagged 'Stable')
│       ├── item-preview.ts→ Preview class (tagged 'Preview')
│       └── item-pr.ts     → Pr class (tagged 'Pr')
│
└── release/
    ├── __.ts              → flat barrel (export * from models + apply)
    ├── apply.ts           → apply()
    └── models/
        ├── __.ts
        ├── result.ts      → Result
        ├── options.ts     → ApplyOptions
        └── error.ts       → ReleaseError
```

## Naming Changes

| Old                                        | New                                       |
| ------------------------------------------ | ----------------------------------------- |
| `Api.Release.Models.StablePlannedRelease`  | `Api.Plan.Stable`                         |
| `Api.Release.Models.PreviewPlannedRelease` | `Api.Plan.Preview`                        |
| `Api.Release.Models.PrPlannedRelease`      | `Api.Plan.Pr`                             |
| `Api.Release.Models.PlannedRelease`        | `Api.Plan.Item`                           |
| `Api.Release.Models.ReleasePlan`           | `Api.Plan.Plan`                           |
| `Api.PlanFile.Models.ReleasePlanFile`      | `Api.Plan.Plan` (same schema)             |
| `Api.Release.Models.ReleaseOptions`        | `Api.Plan.Options`                        |
| `Api.Release.Models.PrReleaseOptions`      | `Api.Plan.PrOptions`                      |
| `Api.Release.Ops.stable()`                 | `Api.Plan.stable()`                       |
| `Api.Release.Ops.preview()`                | `Api.Plan.preview()`                      |
| `Api.Release.Ops.pr()`                     | `Api.Plan.pr()`                           |
| `Api.PlanFile.Models.resource`             | `Api.Plan.resource`                       |
| CLI `PLAN_DIR`, `PLAN_FILE`                | `Api.Plan.PLAN_DIR`, `Api.Plan.PLAN_FILE` |
| `Api.Release.Ops.apply()`                  | `Api.Release.apply()`                     |
| `Api.Release.Models.ReleaseResult`         | `Api.Release.Result`                      |
| `Api.Release.Models.ApplyOptions`          | `Api.Release.ApplyOptions`                |

## Key Simplifications

1. **One Plan schema** - `Plan` IS the file format. Resource handles codec. No separate domain model vs file model.
2. **Flat namespaces** - `Api.Plan.stable()` not `Api.Plan.Ops.stable()`
3. **Options colocated with ops** - not in models
4. **Constants in API** - CLI doesn't define `PLAN_DIR`/`PLAN_FILE`

## Usage After Refactor

```typescript
// Generate a plan
const plan = yield * Api.Plan.stable({ packages }, options)

// Write/read plan file
yield * Api.Plan.resource.write(plan, Api.Plan.PLAN_DIR)
const planOpt = yield * Api.Plan.resource.read(Api.Plan.PLAN_DIR)

// Type guards
Api.Plan.Stable.is(item)
Api.Plan.Preview.is(item)

// Execute release
const result = yield * Api.Release.apply(plan)
```
