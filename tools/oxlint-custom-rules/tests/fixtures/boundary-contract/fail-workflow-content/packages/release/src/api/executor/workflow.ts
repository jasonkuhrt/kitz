import { Flo } from '@kitz/flo'
import { resolvePublishSemantics } from '../publishing.js'
import { ExecutorError } from './errors.js'
import { ArtifactManifest } from './workflow/payload.js'

export const manifest = ArtifactManifest.make({
  publishedAt: new Date().toISOString(),
  semantics: resolvePublishSemantics,
  error: ExecutorError,
  workflow: Flo,
})
