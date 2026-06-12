/**
 * @module api/clock
 *
 * The single wall-clock boundary for release. Production code must read time
 * through this module (enforced by `architecture-boundaries.test.ts`) so the
 * Effect test clock controls every timestamp.
 */
import { DateTime, Effect } from 'effect'

/** Current instant as a `DateTime.Utc` (read through the Effect clock). */
export const now: Effect.Effect<DateTime.Utc> = DateTime.now

/**
 * Current instant as an ISO-8601 UTC string. Prefer {@link now} — the string
 * form exists for surfaces whose serialized contract is a plain string
 * (e.g. `Plan.timestamp`).
 */
export const nowIso: Effect.Effect<string> = Effect.map(DateTime.now, DateTime.formatIso)
