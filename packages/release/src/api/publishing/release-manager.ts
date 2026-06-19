import { Context } from 'effect'
import type { rehearse } from '../artifact.js'
import type { execute, resume, status } from '../executor/execute.js'
import type { prove, readForPlan } from '../proof.js'

export interface ReleaseManagerService {
  readonly prove: typeof prove
  readonly readProofForPlan: typeof readForPlan
  readonly rehearse: typeof rehearse
  readonly execute: typeof execute
  readonly resume: typeof resume
  readonly status: typeof status
}

export class ReleaseManager extends Context.Service<ReleaseManager, ReleaseManagerService>()(
  'releasemanager',
) {}
