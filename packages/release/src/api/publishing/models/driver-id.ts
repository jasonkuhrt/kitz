import { Schema } from 'effect'

export const publishDriverIdValues = ['npm', 'pnpm', 'bun'] as const

export const PublishDriverId = Schema.Literals(publishDriverIdValues)
export type PublishDriverId = typeof PublishDriverId.Type
