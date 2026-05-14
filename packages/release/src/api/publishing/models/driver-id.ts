import { Schema } from 'effect'

export const PublishDriverId = Schema.Literals(['npm', 'pnpm', 'bun'])
export type PublishDriverId = typeof PublishDriverId.Type
