# 0156 Shared PR Context Resolver

## Context

Release preview, PR title management, and ephemeral planning were rediscovering branch, repository, and explicit PR metadata in separate code paths.

## Decision

Introduce a shared GitHub context object in the explorer API and reuse it when resolving pull requests or building recon snapshots for PR-facing workflows.

## Result

Preview and title flows now thread one resolved context through branch and repository lookups, while planner PR-number resolution reuses the same path instead of maintaining its own discovery logic.
