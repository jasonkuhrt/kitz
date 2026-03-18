# 0155 Explicit Release Dependency Cycle Handling

## Context

Release payload ordering previously broke local dependency cycles by picking the next package alphabetically and dropping unresolved dependency edges from the workflow payload.

## Decision

Reject planned local dependency cycles with a first-class executor error that reports the participating packages and human-readable dependency edges.

## Result

Release execution now fails before preflight or publish work starts when the planned workspace graph is cyclic, and operators get a deterministic explanation of what must be untangled before retrying.
