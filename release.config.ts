import { defineConfig } from './packages/release/build/api/__.js'

export default defineConfig({
  publishing: {
    official: { mode: 'manual' },
    candidate: { mode: 'manual' },
    ephemeral: { mode: 'manual' },
  },
})
