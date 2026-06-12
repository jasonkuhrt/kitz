import { Flo } from '@kitz/flo'
import { resolvePublishSemantics } from '../publishing.js'
import { ExecutorError } from './errors.js'

export { tagForRelease } from './workflow/release-info.js'

export const ReleaseWorkflow = Flo.Workflow.make({
  run: () => resolvePublishSemantics(ExecutorError),
})
