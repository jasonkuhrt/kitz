import { defineConfig } from './packages/release/src/api/__.ts'

export default defineConfig({
  conventionalCommitSettings: {
    types: {
      improve: 'minor',
      // Historical no-release types in existing git history.
      refator: null,
      tests: null,
    },
  },
  publishing: {
    official: { mode: 'manual' },
    candidate: { mode: 'manual' },
    ephemeral: { mode: 'manual' },
  },
  operator: {
    prepareScripts: ['release:build'],
  },
})
