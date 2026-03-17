# Lucid Report

## Scope

Generated package-local documentation for `packages/paka` with a focus on the new semver prototype and the existing extraction model.

## Outputs

- `README.md`
- `docs/overview.md`
- `docs/quickstart.md`
- `docs/guides/extract-interface-models.md`
- `docs/guides/calculate-semver-from-exports.md`
- `docs/reference/public-api.md`
- `docs/reference/cli.md`

## Source truth used

- `packages/paka/src/__.ts`
- `packages/paka/src/_.ts`
- `packages/paka/src/extractor/extract.ts`
- `packages/paka/src/extractor/nodes/*.ts`
- `packages/paka/src/adaptors/vitepress.ts`
- `packages/paka/src/md-to-jsdoc.ts`
- `packages/paka/src/semver.ts`
- `packages/paka/src/cli.ts`
- `packages/paka/src/semver.test.ts`
- repo-local CLI output from `bun packages/paka/src/cli.ts --help`
- repo-local CLI output from `bun packages/paka/src/cli.ts semver ...`

## Verification plan

- check markdown files for broken local links
- re-run package type, lint, and test scripts
- smoke-test extraction and semver examples with Bun
