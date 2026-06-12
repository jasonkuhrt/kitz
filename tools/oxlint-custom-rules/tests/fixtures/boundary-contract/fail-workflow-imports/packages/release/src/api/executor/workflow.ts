import { Flo } from '@kitz/flo'
import { resolvePublishSemantics } from '../publishing.js'
import { ExecutorError } from './errors.js'
import { Fs } from '@kitz/fs'
import { prepareRelease } from './workflow/activities/prepare.js'

export const ReleaseWorkflow = Flo.Workflow.make({
  run: () => prepareRelease(resolvePublishSemantics, ExecutorError, Fs),
})
