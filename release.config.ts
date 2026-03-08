import { defineConfig } from './packages/release/src/api/__.ts'

export default defineConfig({
  publishing: {
    official: { mode: 'manual' },
    candidate: { mode: 'manual' },
    ephemeral: { mode: 'manual' },
  },
  operator: {
    prepareScripts: ['release:build'],
  },
})
