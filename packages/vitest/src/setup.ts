import { addEqualityTesters, Path } from './index.js'

// vitest setupFile entrypoint: registers the shared @kitz matcher layer on the
// per-worker `expect`. Referenced from the root vite.config.mts as
// `setupFiles: ['@kitz/vitest/setup']`.
addEqualityTesters()
Path.addMatchers()
