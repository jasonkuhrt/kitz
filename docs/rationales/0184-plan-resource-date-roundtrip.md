# 0184 Plan Resource Date Roundtrip

## Context

Release plans persist full `ReleaseCommit` metadata to `.release/plan.json`, but the shared JSON resource was decoding commit dates as raw strings on read.

## Decision

Teach the shared git `Commit` schema to decode only canonical ISO 8601 UTC date strings into `Date` values and encode valid `Date` values back to the same format.

## Result

Release plans can now be written and read back through the planner resource without tripping over commit dates, and the git package regression coverage now runs through the normal workspace `test:packages` entrypoint.
