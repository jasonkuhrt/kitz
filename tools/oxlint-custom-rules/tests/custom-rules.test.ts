import { spawnSync } from 'node:child_process'
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

  return JSON.parse(result.stdout) as OxlintJsonOutput
}

const countDiagnosticsForRule = (
  output: OxlintJsonOutput,
  ruleName: string,
): number => output.diagnostics.filter((diagnostic) => diagnostic.code.includes(ruleName)).length

const rules: ReadonlyArray<{
  readonly name: string
  readonly failingFixtures: ReadonlyArray<string>
  readonly passingFixtures: ReadonlyArray<string>
}> = [
  {
    name: `no-json-parse`,
    failingFixtures: [`no-json-parse/fail-1.ts`, `no-json-parse/fail-2.ts`],
    passingFixtures: [`no-json-parse/pass-1.ts`, `no-json-parse/pass-2.ts`],
  },
  {
    name: `no-try-catch`,
    failingFixtures: [`no-try-catch/fail-1.ts`, `no-try-catch/fail-2.ts`],
    passingFixtures: [`no-try-catch/pass-1.ts`, `no-try-catch/pass-2.ts`],
  },
  {
    name: `no-native-promise-construction`,
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
    name: `no-type-assertion`,
    failingFixtures: [`no-type-assertion/fail-1.ts`, `no-type-assertion/fail-2.ts`],
    passingFixtures: [`no-type-assertion/pass-1.ts`, `no-type-assertion/pass-2.ts`],
  },
  {
    name: `no-native-map-set-in-effect-modules`,
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
    name: `no-throw`,
    failingFixtures: [`no-throw/fail-1.ts`, `no-throw/fail-2.ts`],
    passingFixtures: [`no-throw/pass-1.test.ts`, `no-throw/pass-2.ts`],
  },
  {
    name: `no-promise-then-chain`,
    failingFixtures: [`no-promise-then-chain/fail-1.ts`, `no-promise-then-chain/fail-2.ts`],
    passingFixtures: [`no-promise-then-chain/pass-1.ts`, `no-promise-then-chain/pass-2.ts`],
  },
  {
    name: `no-effect-run-in-library-code`,
    failingFixtures: [`no-effect-run-in-library-code/fail-1.ts`, `no-effect-run-in-library-code/fail-2.ts`],
    passingFixtures: [
      `no-effect-run-in-library-code/src/cli/pass-1.ts`,
      `no-effect-run-in-library-code/pass-2.test.ts`,
    ],
  },
  {
    name: `require-typed-effect-errors`,
    failingFixtures: [`require-typed-effect-errors/fail-1.ts`, `require-typed-effect-errors/fail-2.ts`],
    passingFixtures: [`require-typed-effect-errors/pass-1.ts`, `require-typed-effect-errors/pass-2.ts`],
  },
  {
    name: `require-schema-decode-at-boundary`,
    failingFixtures: [
      `require-schema-decode-at-boundary/packages/http/fail-1.ts`,
      `require-schema-decode-at-boundary/packages/env/fail-2.ts`,
    ],
    passingFixtures: [
      `require-schema-decode-at-boundary/packages/http/pass-1.ts`,
      `require-schema-decode-at-boundary/packages/env/pass-2.ts`,
    ],
  },
]

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
