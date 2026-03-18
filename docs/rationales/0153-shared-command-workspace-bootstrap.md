# 0153 Shared Command Workspace Bootstrap

## Context

Release commands repeatedly loaded config, resolved workspace packages, and handled the zero-package case independently.

## Decision

Use one typed command-workspace bootstrap that returns either a ready workspace or an empty-workspace result.

## Result

Commands now share one setup path for config and package resolution while still controlling their own user-facing behavior when no packages are found.
