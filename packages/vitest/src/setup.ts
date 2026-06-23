import { addEqualityTesters } from './index.js'

// vitest setupFile entrypoint: registers the Effect-`Equal`-aware equality tester
// on the per-worker `expect`. Referenced from the root vite.config.mts as
// `setupFiles: ['@kitz/vitest/setup']`.
addEqualityTesters()
