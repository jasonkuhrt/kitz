# Mission: Upgrade to Effect v4 Beta

## Objective
Hard cut the entire kitz monorepo from Effect v3 to Effect v4 beta. No backwards compatibility, no gradual migration. First-principles clean cut.

## Requirements
- All Effect dependencies upgraded to v4 beta
- All breaking changes resolved
- CI fully green (build, lint, tests)
- PR created when done

## Non-Negotiable: Zero Type Safety Regression

**Any cast added, any regression in the use of inference, any public interface that requires more annotations or has degraded in any way from trunk in type safety will be immediately rejected and must be fixed. There is zero negotiation room.**

This means:
- `as any` casts are NOT acceptable as a permanent solution. Every cast must be justified as a temporary workaround for an upstream Effect v4 beta type issue, and must be tracked for removal.
- Public API signatures must not require callers to add casts or extra type annotations that weren't needed in v3.
- If v4 changes make a type less inferrable, the fix must restore inference — not paper over it with casts.
- Internal `as any` casts on Schema.Class / branded type boundaries (where v4's `DecodingServices` constraint forces it) are the ONLY acceptable exception, and only when the alternative is worse type safety at the call site.

## Status
- [x] Persist mission (this file)
- [x] Audit current Effect dependency versions
- [x] Research Effect v4 breaking changes
- [x] Upgrade all Effect packages (effect 4.0.0-beta.31)
- [x] Fix all breaking changes across codebase
- [x] Build passes (all 40 packages)
- [ ] Tests pass (6 test failures remaining — agents fixing)
- [ ] Lint passes (19 errors remaining — agents fixing)
- [ ] Create PR
