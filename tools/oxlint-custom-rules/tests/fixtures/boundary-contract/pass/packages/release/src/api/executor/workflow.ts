import { Flo } from '@kitz/flo'
import { resolvePublishSemantics } from '../publishing.js'
import { ExecutorError } from './errors.js'
import { prepareRelease } from './workflow/activities/prepare.js'
import { ReleasePayload } from './workflow/payload.js'

export { ReleasePayload } from './workflow/payload.js'
export { formatTag, toReleaseInfo } from './workflow/release-info.js'

export const ReleaseWorkflow = Flo.Workflow.make({
  payload: ReleasePayload,
  run: () => prepareRelease(resolvePublishSemantics, ExecutorError),
})
