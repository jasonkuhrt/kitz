#!/usr/bin/env bun

import { execFileSync } from 'node:child_process'

let output = ''

try {
  output = execFileSync(
    './node_modules/.bin/oxlint',
    [
      '--config',
      '.oxlintrc.custom-strict.json',
      '--import-plugin',
      'packages',
      '--format',
      'json',
      'packages',
    ],
    { encoding: 'utf8' },
  )
} catch (error) {
  output = typeof error.stdout === 'string' ? error.stdout : ''
}

const parsedOutput = output.trim() === '' ? { diagnostics: [] } : JSON.parse(output)
const diagnostics = parsedOutput.diagnostics.filter((diagnostic) =>
  diagnostic.code.includes('resolver-platform-dispatch'),
)

if (diagnostics.length === 0) {
  process.stdout.write('No resolver-platform-dispatch violations found.\n')
  process.exit(0)
}

for (const diagnostic of diagnostics) {
  process.stderr.write(`${diagnostic.filename}: ${diagnostic.message}\n`)
}

process.exit(1)
