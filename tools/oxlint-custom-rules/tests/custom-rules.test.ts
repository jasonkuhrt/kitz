import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

interface OxlintDiagnostic {
  readonly code: string
  readonly message: string
  readonly filename: string
}

interface OxlintJsonOutput {
  readonly diagnostics: ReadonlyArray<OxlintDiagnostic>
}

const TESTS_ROOT = path.resolve(__dirname)
const FIXTURES_ROOT = path.resolve(TESTS_ROOT, `fixtures`)
const CONFIG_PATH = path.resolve(TESTS_ROOT, `oxlint-test-config.json`)
const OXLINT_BIN = path.resolve(TESTS_ROOT, `../../../node_modules/.bin/oxlint`)

const runOxlint = (ruleName: string, fixtureFilePath: string): OxlintJsonOutput => {
  const result = spawnSync(
    OXLINT_BIN,
    [
      `--config`,
      CONFIG_PATH,
      `--disable-nested-config`,
      `--import-plugin`,
      `--format`,
      `json`,
      fixtureFilePath,
    ],
    {
      cwd: FIXTURES_ROOT,
      encoding: `utf8`,
    },
  )

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const output = `${result.stdout}\n${result.stderr}`.trim()
    throw new Error(`Oxlint exited with code ${result.status}: ${output}`)
  }

  // oxlint-disable-next-line kitz/schema/no-json-parse
  return JSON.parse(result.stdout) as OxlintJsonOutput
}

const countDiagnosticsForRule = (output: OxlintJsonOutput, ruleName: string): number =>
  output.diagnostics.filter((diagnostic) => diagnostic.code.includes(ruleName)).length

const rules: ReadonlyArray<{
  readonly name: string
  readonly failingFixtures: ReadonlyArray<string>
  readonly passingFixtures: ReadonlyArray<string>
}> = [
  {
    name: `schema/no-json-parse`,
    failingFixtures: [`no-json-parse/fail-1.ts`, `no-json-parse/fail-2.ts`],
    passingFixtures: [`no-json-parse/pass-1.ts`, `no-json-parse/pass-2.ts`],
  },
  {
    name: `error/no-try-catch`,
    failingFixtures: [`no-try-catch/fail-1.ts`, `no-try-catch/fail-2.ts`],
    passingFixtures: [
      `no-try-catch/pass-1.ts`,
      `no-try-catch/pass-2.ts`,
      `no-try-catch/pass-3.test.ts`,
    ],
  },
  {
    name: `effect/no-native-promise-construction`,
    failingFixtures: [
      `no-native-promise-construction/fail-1.ts`,
      `no-native-promise-construction/fail-2.ts`,
    ],
    passingFixtures: [
      `no-native-promise-construction/pass-1.ts`,
      `no-native-promise-construction/pass-2.ts`,
    ],
  },
  {
    name: `domain/no-native-map-set`,
    failingFixtures: [
      `packages/release/src/no-native-map-set-in-effect-modules/fail-1.ts`,
      `packages/release/src/no-native-map-set-in-effect-modules/fail-2.ts`,
    ],
    passingFixtures: [
      `packages/release/src/no-native-map-set-in-effect-modules/pass-1.ts`,
      `packages/release/src/no-native-map-set-in-effect-modules/pass-2.ts`,
    ],
  },
  {
    name: `module/no-nodejs-builtins`,
    failingFixtures: [
      `no-nodejs-builtin-imports/fail-node-not-covered/src/feature.ts`,
      `no-nodejs-builtin-imports/fail-fs-extra-not-covered/src/feature.ts`,
      `no-nodejs-builtin-imports/fail-pathe-not-covered/src/feature.ts`,
      `no-nodejs-builtin-imports/fail-invalid-nearest-package/src/feature.ts`,
      `no-nodejs-builtin-imports/fail-unreadable-nearest-package/src/feature.ts`,
    ],
    passingFixtures: [
      `no-nodejs-builtin-imports/pass-node-covered-by-exports-node/src/feature.ts`,
      `no-nodejs-builtin-imports/pass-node-covered-by-imports-bun/src/runtime.ts`,
      `no-nodejs-builtin-imports/pass-platform-implementation.node.ts`,
    ],
  },
  {
    name: `module/resolver-platform-dispatch`,
    failingFixtures: [
      `resolver-platform-dispatch/packages/demo/src/fail-globalthis-bun-dispatch.ts`,
      `resolver-platform-dispatch/packages/demo/src/fail-process-versions-bun-dispatch.ts`,
      `resolver-platform-dispatch/packages/demo/src/fail-direct-node-file-import.ts`,
      `resolver-platform-dispatch/packages/demo/src/fail-direct-node-package-import.ts`,
      `resolver-platform-dispatch/packages/demo/src/fail-direct-effect-node-package-import.ts`,
      `resolver-platform-dispatch/packages/demo/src/fail-direct-effect-bun-package-import.ts`,
      `resolver-platform-dispatch/packages/demo/src/fail-direct-effect-node-subpath-import.ts`,
      `resolver-platform-dispatch/packages/demo/src/lang/colorize.deno.ts`,
    ],
    passingFixtures: [
      `resolver-platform-dispatch/packages/demo/src/pass-kitz-platform-root-import.ts`,
      `resolver-platform-dispatch/packages/platform/src/pass-direct-effect-node-package-import.ts`,
      `resolver-platform-dispatch/packages/demo/src/lang/__.ts`,
      `resolver-platform-dispatch/packages/demo/src/lang/colorize.node.ts`,
      `resolver-platform-dispatch/packages/demo/src/lang/colorize.bun.ts`,
      `resolver-platform-dispatch/packages/demo/src/pass-feature-detection.ts`,
    ],
  },
  {
    name: `schema/schema-parsing-contract`,
    failingFixtures: [
      `schema-parsing-contract/packages/release/src/api/fail-exact-release-tag.ts`,
      `schema-parsing-contract/packages/release/src/api/fail-release-tag-split.ts`,
      `schema-parsing-contract/packages/release/src/api/fail-template-literal-semver.ts`,
      `schema-parsing-contract/packages/demo/src/fail-missing-from-literal.ts`,
      `schema-parsing-contract/packages/demo/src/fail-missing-static-from-literal.ts`,
      `schema-parsing-contract/pin-fail/packages/pkg/src/pin/pin.ts`,
    ],
    passingFixtures: [
      `schema-parsing-contract/packages/release/src/api/pass-release-tag-codec.ts`,
      `schema-parsing-contract/packages/demo/src/pass-from-literal.ts`,
      `schema-parsing-contract/packages/demo/src/pass-static-from-literal.ts`,
      `schema-parsing-contract/pin-pass/packages/pkg/src/pin/pin.ts`,
    ],
  },
  {
    name: `error/no-throw`,
    failingFixtures: [`no-throw/fail-1.ts`, `no-throw/fail-2.ts`],
    passingFixtures: [`no-throw/pass-1.test.ts`, `no-throw/pass-2.ts`],
  },
  {
    name: `effect/no-promise-then-chain`,
    failingFixtures: [`no-promise-then-chain/fail-1.ts`, `no-promise-then-chain/fail-2.ts`],
    passingFixtures: [
      `no-promise-then-chain/pass-1.ts`,
      `no-promise-then-chain/pass-2.ts`,
      `no-promise-then-chain/pass-3.test.ts`,
    ],
  },
  {
    name: `effect/no-effect-run-in-library-code`,
    failingFixtures: [
      `no-effect-run-in-library-code/fail-1.ts`,
      `no-effect-run-in-library-code/fail-2.ts`,
    ],
    passingFixtures: [
      `no-effect-run-in-library-code/src/cli/pass-1.ts`,
      `no-effect-run-in-library-code/pass-2.test.ts`,
      `no-effect-run-in-library-code/scripts/pass-3.ts`,
    ],
  },
  {
    name: `error/require-typed-effect-errors`,
    failingFixtures: [
      `require-typed-effect-errors/fail-1.ts`,
      `require-typed-effect-errors/fail-2.ts`,
    ],
    passingFixtures: [
      `require-typed-effect-errors/pass-1.ts`,
      `require-typed-effect-errors/pass-2.ts`,
    ],
  },
  {
    name: `schema/require-schema-decode`,
    failingFixtures: [
      `require-schema-decode-at-boundary/packages/http/fail-1.ts`,
      `require-schema-decode-at-boundary/packages/env/fail-2.ts`,
    ],
    passingFixtures: [
      `require-schema-decode-at-boundary/packages/http/pass-1.ts`,
      `require-schema-decode-at-boundary/packages/env/pass-2.ts`,
    ],
  },
  {
    name: `domain/no-process-env`,
    failingFixtures: [
      `no-process-env-outside-config-modules/fail-1.ts`,
      `no-process-env-outside-config-modules/fail-2.ts`,
    ],
    passingFixtures: [
      `no-process-env-outside-config-modules/src/config/pass-1.ts`,
      `no-process-env-outside-config-modules/pass-2.test.ts`,
    ],
  },
  {
    name: `domain/no-date-now`,
    failingFixtures: [`no-date-now-in-domain/fail-1.ts`, `no-date-now-in-domain/fail-2.ts`],
    passingFixtures: [`no-date-now-in-domain/src/cli/pass-1.ts`, `no-date-now-in-domain/pass-2.ts`],
  },
  {
    name: `domain/no-math-random`,
    failingFixtures: [`no-math-random-in-domain/fail-1.ts`, `no-math-random-in-domain/fail-2.ts`],
    passingFixtures: [
      `no-math-random-in-domain/src/cli/pass-1.ts`,
      `no-math-random-in-domain/pass-2.ts`,
    ],
  },
  {
    name: `domain/no-console`,
    failingFixtures: [
      `no-console-in-effect-modules/packages/foo/src/fail-1.ts`,
      `no-console-in-effect-modules/packages/foo/src/fail-2.ts`,
    ],
    passingFixtures: [
      `no-console-in-effect-modules/packages/foo/src/cli/pass-1.ts`,
      `no-console-in-effect-modules/packages/foo/src/pass-2.ts`,
    ],
  },
  {
    name: `error/require-tagged-error-types`,
    failingFixtures: [
      `require-tagged-error-types/fail-1.ts`,
      `require-tagged-error-types/fail-2.ts`,
    ],
    passingFixtures: [
      `require-tagged-error-types/pass-1.ts`,
      `require-tagged-error-types/pass-2.ts`,
    ],
  },
  {
    name: `module/namespace-file-conventions`,
    failingFixtures: [
      `namespace-file-conventions/packages/demo/src/foo/_.ts`,
      `namespace-file-conventions/packages/demo/src/bar-baz/_.ts`,
      `namespace-file-conventions/packages/core/src/fn/core/_.ts`,
      `namespace-file-conventions/packages/demo/src/zed/_.ts`,
    ],
    passingFixtures: [
      `namespace-file-conventions/packages/demo/src/_.ts`,
      `namespace-file-conventions/packages/demo/src/qux/_.ts`,
      `namespace-file-conventions/packages/core/src/err/core/_.ts`,
      `namespace-file-conventions/packages/demo/src/type-target/_.ts`,
      `namespace-file-conventions/packages/demo/src/zip/_.ts`,
    ],
  },
  {
    name: `module/barrel-file-conventions`,
    failingFixtures: [
      `barrel-file-conventions/packages/barrel/src/a/__.ts`,
      `barrel-file-conventions/packages/barrel/src/b/__.ts`,
      `barrel-file-conventions/packages/barrel/src/aggregate-fail/__.ts`,
    ],
    passingFixtures: [
      `barrel-file-conventions/packages/barrel/src/c/__.ts`,
      `barrel-file-conventions/packages/barrel/src/d/__.ts`,
      `barrel-file-conventions/packages/barrel/src/aggregate-pass/__.ts`,
      `barrel-file-conventions/packages/barrel/src/impl-only/__.ts`,
    ],
  },
  {
    name: `module/module-structure-conventions`,
    failingFixtures: [
      `module-structure-conventions/packages/missing-barrel/src/alpha/_.ts`,
      `module-structure-conventions/packages/wrong-target/src/beta/_.ts`,
      `module-structure-conventions/packages/root-missing/src/value.ts`,
    ],
    passingFixtures: [
      `module-structure-conventions/packages/passpkg/src/gamma/_.ts`,
      `module-structure-conventions/packages/passpkg/src/delta/_.ts`,
    ],
  },
  {
    name: `module/no-deep-imports`,
    failingFixtures: [
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/fail-imports-scoped-impl.ts`,
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/fail-imports-deep-nested.ts`,
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/fail-reexports-scoped-impl.ts`,
      // E2E: realistic package with subpath imports
      `e2e-module-boundaries/packages/demo/src/e2e-fail-deep-import.ts`,
    ],
    passingFixtures: [
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/pass-imports-namespace.ts`,
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/pass-imports-barrel.ts`,
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/pass-imports-no-wall.ts`,
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/pass-test.test.ts`,
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/bar/__.ts`,
      `no-deep-imports-when-namespace-entrypoint-exists/packages/pkg/src/bar/peer.ts`,
      // E2E: importing through the door is valid (no deep import violation)
      `e2e-module-boundaries/packages/demo/src/e2e-pass-through-door.ts`,
    ],
  },
  {
    name: `module/prefer-subpath-imports`,
    failingFixtures: [
      `prefer-subpath-imports/packages/has-imports/src/foo/fail-relative-door.ts`,
      // E2E: relative import to door when #alpha exists
      `e2e-module-boundaries/packages/demo/src/e2e-fail-prefer-subpath.ts`,
    ],
    passingFixtures: [
      `prefer-subpath-imports/packages/no-imports/src/foo/pass-no-hash.ts`,
      `prefer-subpath-imports/packages/has-imports/src/bar/sibling-pass.ts`,
      // E2E: using # subpath import (no relative path to flag)
      `e2e-module-boundaries/packages/demo/src/e2e-pass-subpath-import.ts`,
    ],
  },
  {
    name: `module/subpath-imports-integrity`,
    failingFixtures: [
      `subpath-imports-integrity/fail-broken-ref/packages/broken/src/beta/_.ts`,
      `subpath-imports-integrity/fail-wrong-format/packages/wrongfmt/src/gamma/_.ts`,
      `subpath-imports-integrity/fail-export-wrong-format/packages/exportwrong/src/alpha/_.ts`,
      `subpath-imports-integrity/fail-missing-entry/packages/noentry/src/beta/_.ts`,
      `subpath-imports-integrity/fail-condition-mismatch/packages/mismatch/src/foo/impl.ts`,
      `subpath-imports-integrity/fail-types-field/packages/typed/src/alpha/_.ts`,
    ],
    passingFixtures: [
      `subpath-imports-integrity/pass-valid/packages/good/src/alpha/_.ts`,
      `subpath-imports-integrity/pass-no-imports/packages/noimports/src/value.ts`,
      `subpath-imports-integrity/pass-conditional/packages/conditional/src/lang/impl.ts`,
      `subpath-imports-integrity/fail-missing-entry/packages/noentry/src/alpha/_.ts`,
    ],
  },
]

// ---------------------------------------------------------------------------
// E2E: resolution chain — standalone mini-project with tsconfig + #imports
// ---------------------------------------------------------------------------

const E2E_PROJECT_ROOT = path.resolve(FIXTURES_ROOT, `e2e-module-boundaries/packages/demo`)
const E2E_TSCONFIG = path.resolve(E2E_PROJECT_ROOT, `tsconfig.json`)
const TSGO_BIN = path.resolve(TESTS_ROOT, `../../../node_modules/.bin/tsgo`)

describe(`e2e: resolution chain`, () => {
  test(`tsgo resolves #imports through tsconfig paths`, () => {
    const result = spawnSync(TSGO_BIN, [`--noEmit`, `-p`, E2E_TSCONFIG], {
      encoding: `utf8`,
    })

    if (result.status !== 0) {
      const output = `${result.stdout}\n${result.stderr}`.trim()
      throw new Error(`tsgo --noEmit failed (exit ${result.status}):\n${output}`)
    }

    expect(result.status).toBe(0)
  })

  test(`oxlint flags deep import in e2e project`, () => {
    const output = runOxlint(
      `module/no-deep-imports`,
      `e2e-module-boundaries/packages/demo/src/e2e-fail-deep-import.ts`,
    )
    expect(
      countDiagnosticsForRule(output, `module/no-deep-imports`),
    ).toBeGreaterThan(0)
  })

  test(`oxlint flags prefer-subpath violation in e2e project`, () => {
    const output = runOxlint(
      `module/prefer-subpath-imports`,
      `e2e-module-boundaries/packages/demo/src/e2e-fail-prefer-subpath.ts`,
    )
    expect(countDiagnosticsForRule(output, `module/prefer-subpath-imports`)).toBeGreaterThan(0)
  })

  test(`oxlint allows door import in e2e project`, () => {
    const output = runOxlint(
      `module/no-deep-imports`,
      `e2e-module-boundaries/packages/demo/src/e2e-pass-through-door.ts`,
    )
    expect(
      countDiagnosticsForRule(output, `module/no-deep-imports`),
    ).toBe(0)
  })

  test(`consumer.ts using #imports produces no deep-import violations`, () => {
    const output = runOxlint(
      `module/no-deep-imports`,
      `e2e-module-boundaries/packages/demo/src/consumer.ts`,
    )
    expect(
      countDiagnosticsForRule(output, `module/no-deep-imports`),
    ).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// E2E: subpath-imports-integrity tsconfig autofix
// ---------------------------------------------------------------------------

describe(`e2e: subpath-imports-integrity tsconfig autofix`, () => {
  test(`detects drift and auto-fixes tsconfig.json`, () => {
    // Copy the drift fixture to a temp dir so the autofix write doesn't pollute fixtures
    const fixtureDir = path.resolve(
      FIXTURES_ROOT,
      `subpath-imports-integrity/fail-tsconfig-drift/packages/drifted`,
    )
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `oxlint-tsconfig-drift-`))
    const tmpPkgDir = path.join(tmpDir, `packages/drifted`)
    fs.mkdirSync(path.join(tmpPkgDir, `src/alpha`), { recursive: true })

    // Copy package.json, tsconfig.json, and source file
    fs.copyFileSync(path.join(fixtureDir, `package.json`), path.join(tmpPkgDir, `package.json`))
    fs.copyFileSync(path.join(fixtureDir, `tsconfig.json`), path.join(tmpPkgDir, `tsconfig.json`))
    fs.copyFileSync(path.join(fixtureDir, `src/alpha/_.ts`), path.join(tmpPkgDir, `src/alpha/_.ts`))

    // Verify tsconfig is drifted before running
    // oxlint-disable-next-line kitz/schema/no-json-parse
    const beforeTsconfig = JSON.parse(
      fs.readFileSync(path.join(tmpPkgDir, `tsconfig.json`), `utf8`),
    )
    expect(beforeTsconfig.compilerOptions.paths[`#alpha`]).toEqual([`./src/WRONG/_.js`])

    // Run oxlint on a source file within the temp package
    const result = spawnSync(
      OXLINT_BIN,
      [
        `--config`,
        CONFIG_PATH,
        `--disable-nested-config`,
        `--import-plugin`,
        `--format`,
        `json`,
        `packages/drifted/src/alpha/_.ts`,
      ],
      {
        cwd: tmpDir,
        encoding: `utf8`,
      },
    )

    if (result.error) {
      throw result.error
    }

    // Parse diagnostics - expect the drift warning
    // oxlint-disable-next-line kitz/schema/no-json-parse
    const output = JSON.parse(result.stdout) as OxlintJsonOutput
    expect(countDiagnosticsForRule(output, `module/subpath-imports-integrity`)).toBeGreaterThan(0)

    // Verify tsconfig was auto-fixed
    // oxlint-disable-next-line kitz/schema/no-json-parse
    const afterTsconfig = JSON.parse(fs.readFileSync(path.join(tmpPkgDir, `tsconfig.json`), `utf8`))
    expect(afterTsconfig.compilerOptions.paths[`#alpha`]).toEqual([`./src/alpha/_.js`])
    expect(afterTsconfig.compilerOptions.paths[`#alpha/*`]).toEqual([`./src/alpha/*.js`])

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})

// ---------------------------------------------------------------------------
// Per-rule fixture tests
// ---------------------------------------------------------------------------

for (const rule of rules) {
  describe(rule.name, () => {
    for (const fixtureFilePath of rule.failingFixtures) {
      test(`flags ${fixtureFilePath}`, () => {
        const output = runOxlint(rule.name, fixtureFilePath)
        expect(countDiagnosticsForRule(output, rule.name)).toBeGreaterThan(0)
      })
    }

    for (const fixtureFilePath of rule.passingFixtures) {
      test(`allows ${fixtureFilePath}`, () => {
        const output = runOxlint(rule.name, fixtureFilePath)
        expect(countDiagnosticsForRule(output, rule.name)).toBe(0)
      })
    }
  })
}
