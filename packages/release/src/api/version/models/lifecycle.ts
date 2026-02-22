import { Schema as S } from 'effect'

export const LifecycleSchema = S.Literal('official', 'candidate', 'ephemeral')
export type Lifecycle = typeof LifecycleSchema.Type
