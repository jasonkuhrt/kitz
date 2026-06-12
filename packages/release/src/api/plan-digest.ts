/**
 * @module api/plan-digest
 *
 * Canonical digest of a {@link Plan}.
 *
 * Lives in its own module (not `digest.ts`) because it needs the runtime
 * `Plan` codec: `digest.ts → plan.ts → contract → digest.ts` would be a
 * module cycle that hits the temporal dead zone of the `Digest` class during
 * contract evaluation.
 */
import { Schema } from 'effect'
import { Digest, sha256Json } from './digest.js'
import { Plan } from './planner/models/plan.js'

/**
 * The plan's frozen digest when present, otherwise the SHA-256 of the plan's
 * canonical encoded form.
 */
export const digestForPlan = (plan: Plan): Digest =>
  plan.planDigest ?? sha256Json(Schema.encodeSync(Plan)(plan))
