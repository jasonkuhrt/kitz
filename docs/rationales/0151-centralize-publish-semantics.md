# 0151 Centralize Publish Semantics

## Context

Release runtime behavior had been split between config defaults, `apply`, preview runbooks, and executor workflow branches.

## Decision

Use `Api.Publishing.resolvePublishSemantics` as the typed runtime source of truth for:

- dist-tag resolution
- prerelease semantics
- force-push tag behavior
- GitHub release title style

## Result

Candidate and ephemeral release behavior now flows through one helper, so callers stop duplicating lifecycle-specific tag logic and custom-tag behavior is covered in tests.
