# Vendored `tsgolint` Upstream Reference

This directory vendors `tsgolint` so we can ship repo-local type-aware custom rules.

## Pinned Upstream

- `tsgolint` tag: `v0.15.0`
- `tsgolint` commit: `ed00f04de6626bd8927ac7d76d58a1f5c086932c`
- `typescript-go` submodule commit: `023a4c9ef89e1aa76ff39f5d30f6d1c7aa75e858`

## Sync Procedure

1. Replace `tools/tsgolint` with the desired upstream tag/commit.
2. Initialize `tools/tsgolint/typescript-go` at the submodule commit referenced by upstream.
3. Apply upstream `tools/tsgolint/patches/*.patch` to `tools/tsgolint/typescript-go`.
4. Copy patched `typescript-go/internal/collections/*.go` to `tools/tsgolint/internal/collections/`.
5. Build and test:
   - `pnpm run build:tsgolint`
   - `go test ./tools/tsgolint/internal/rules/...`
6. Re-apply and verify local custom rules still register in `cmd/tsgolint/main.go` (for example the local override of `no-unsafe-type-assertion` via `kitz_no_type_assertion`).
