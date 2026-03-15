// oxlint-disable kitz/module/subpath-imports-integrity
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import os from 'node:os'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import path from 'node:path'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { spawnSync } from 'node:child_process'
// oxlint-disable-next-line kitz/module/no-nodejs-builtins
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { OxlintRules } from './_.js'

interface OxlintDiagnostic {
  readonly code: string
  readonly message: string
  readonly filename: string
}

interface OxlintJsonOutput {
  readonly diagnostics: ReadonlyArray<OxlintDiagnostic>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, `../../..`)
const OXLINT_BIN = path.join(REPO_ROOT, `node_modules`, `.bin`, `oxlint`)
const RECOMMENDED_JSON_PATH = path.resolve(__dirname, `../configs/recommended.json`)
const STRICT_JSON_PATH = path.resolve(__dirname, `../configs/strict.json`)

const runOxlint = (configPath: string, filePath: string): OxlintJsonOutput => {
  const result = spawnSync(
    OXLINT_BIN,
    [`--config`, configPath, `--disable-nested-config`, `--format`, `json`, filePath],
    {
      cwd: REPO_ROOT,
      encoding: `utf8`,
    },
  )

  if (result.error) {
    throw result.error
  }

  if ((result.status ?? 1) !== 0 && result.status !== 1) {
    const output = `${result.stdout}\n${result.stderr}`.trim()
    throw new Error(`Oxlint exited with code ${result.status}: ${output}`)
  }

  const jsonStartIndex = result.stdout.indexOf(`{`)

  if (jsonStartIndex === -1) {
    const output = `${result.stdout}\n${result.stderr}`.trim()
    throw new Error(`Oxlint did not produce JSON output: ${output}`)
  }

  // oxlint-disable-next-line kitz/schema/no-json-parse
  return JSON.parse(result.stdout.slice(jsonStartIndex)) as OxlintJsonOutput
}

const withTempProject = <A>(run: (projectDir: string) => A): A => {
  const projectDir = mkdtempSync(path.join(os.tmpdir(), `kitz-oxlint-rules-`))

  try {
    return run(projectDir)
  } finally {
    rmSync(projectDir, { recursive: true, force: true })
  }
}

describe(`OxlintRules`, () => {
  test(`recommendedConfig exposes the published plugin alias`, () => {
    expect(OxlintRules.recommendedConfig.jsPlugins).toEqual([
      {
        name: `kitz`,
        specifier: expect.stringContaining(`/packages/oxlint-rules/plugin.mjs`),
      },
    ])
    expect(OxlintRules.recommendedConfig.rules[`kitz/schema/no-json-parse`]).toBe(`warn`)
  })

  test(`recommended JSON preset loads the packaged plugin`, () => {
    const output = withTempProject((projectDir) => {
      const filePath = path.join(projectDir, `demo.ts`)
      const configPath = path.join(projectDir, `.oxlintrc.json`)

      writeFileSync(filePath, `const value = JSON.parse(input)\n`, `utf8`)
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            extends: [RECOMMENDED_JSON_PATH],
          },
          null,
          2,
        ) + `\n`,
        `utf8`,
      )

      return runOxlint(configPath, filePath)
    })

    expect(output.diagnostics.some((diagnostic) => diagnostic.code.includes(`no-json-parse`))).toBe(
      true,
    )
  })

  test(`strict JSON preset escalates stable Kitz rules to errors`, () => {
    const output = withTempProject((projectDir) => {
      const filePath = path.join(projectDir, `demo.ts`)
      const configPath = path.join(projectDir, `.oxlintrc.json`)

      writeFileSync(filePath, `const value = JSON.parse(input)\n`, `utf8`)
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            extends: [STRICT_JSON_PATH],
          },
          null,
          2,
        ) + `\n`,
        `utf8`,
      )

      return runOxlint(configPath, filePath)
    })

    expect(OxlintRules.strictConfig.rules[`kitz/schema/no-json-parse`]).toBe(`error`)
    expect(OxlintRules.strictConfig.rules[`kitz/error/no-throw`]).toBe(`off`)
    expect(output.diagnostics.some((diagnostic) => diagnostic.code.includes(`no-json-parse`))).toBe(
      true,
    )
  })
})
