import { Err } from '@kitz/core'
import { Schema as S } from 'effect'

const baseTags = ['kit', 'cmx'] as const

/**
 * Two modules with the same namespace name are both visible from the active AppMap position.
 */
export const CmxDuplicateNamespace = Err.TaggedContextualError('CmxDuplicateNamespace', baseTags, {
  context: S.Struct({
    /** The duplicated namespace name */
    namespace: S.String,
    /** Name of the first AppMap node */
    nodeA: S.String,
    /** Name of the second AppMap node */
    nodeB: S.String,
  }),
  message: (ctx) =>
    `Namespace "${ctx.namespace}" is visible from both "${ctx.nodeA}" and "${ctx.nodeB}"`,
})
export type CmxDuplicateNamespace = InstanceType<typeof CmxDuplicateNamespace>

/**
 * Two capabilities in the same composite declare the same slot name.
 */
export const CmxDuplicateSlot = Err.TaggedContextualError('CmxDuplicateSlot', baseTags, {
  context: S.Struct({
    /** The duplicated slot name */
    slot: S.String,
    /** Name of the first capability */
    capabilityA: S.String,
    /** Name of the second capability */
    capabilityB: S.String,
  }),
  message: (ctx) =>
    `Slot "${ctx.slot}" declared by both "${ctx.capabilityA}" and "${ctx.capabilityB}" in the same composite`,
})
export type CmxDuplicateSlot = InstanceType<typeof CmxDuplicateSlot>

/**
 * The AppMap structure is invalid.
 */
export const CmxInvalidAppMap = Err.TaggedContextualError('CmxInvalidAppMap', baseTags, {
  context: S.Struct({
    /** Details about the structural issue */
    detail: S.String,
  }),
  message: (ctx) => `Invalid AppMap: ${ctx.detail}`,
})
export type CmxInvalidAppMap = InstanceType<typeof CmxInvalidAppMap>

/**
 * The path passed to Resolver.at does not match any node in the AppMap.
 */
export const CmxInvalidPath = Err.TaggedContextualError('CmxInvalidPath', baseTags, {
  context: S.Struct({
    /** The invalid path segments */
    path: S.Array(S.String),
  }),
  message: (ctx) => `Invalid AppMap path: ${ctx.path.join('/')}`,
})
export type CmxInvalidPath = InstanceType<typeof CmxInvalidPath>

/**
 * A visible capability's service dependencies are not satisfied by the scope chain.
 */
export const CmxMissingLayer = Err.TaggedContextualError('CmxMissingLayer', baseTags, {
  context: S.Struct({
    /** The AppMap node where the capability is bound */
    nodeId: S.String,
    /** The service tag that is not provided */
    service: S.String,
  }),
  message: (ctx) =>
    `Node "${ctx.nodeId}" requires service "${ctx.service}" but no layer provides it`,
})
export type CmxMissingLayer = InstanceType<typeof CmxMissingLayer>

/**
 * A slot value does not satisfy the slot's schema. Primarily relevant for Slot.Text.
 */
export const CmxSlotValidationFailure = Err.TaggedContextualError(
  'CmxSlotValidationFailure',
  baseTags,
  {
    context: S.Struct({
      /** The slot name */
      slot: S.String,
      /** The command name */
      command: S.String,
      /** The invalid value */
      value: S.Unknown,
    }),
    message: (ctx) => `Slot "${ctx.slot}" on command "${ctx.command}" failed validation`,
  },
)
export type CmxSlotValidationFailure = InstanceType<typeof CmxSlotValidationFailure>

/**
 * A capability's execute function failed.
 */
export const CmxCapabilityExecutionFailure = Err.TaggedContextualError(
  'CmxCapabilityExecutionFailure',
  baseTags,
  {
    context: S.Struct({
      /** The capability name */
      capability: S.String,
      /** The underlying error */
      cause: S.Unknown,
    }),
    message: (ctx) => `Capability "${ctx.capability}" failed during execution`,
  },
)
export type CmxCapabilityExecutionFailure = InstanceType<typeof CmxCapabilityExecutionFailure>

/** Union of all cmx errors */
export type All =
  | CmxDuplicateNamespace
  | CmxDuplicateSlot
  | CmxInvalidAppMap
  | CmxInvalidPath
  | CmxMissingLayer
  | CmxSlotValidationFailure
  | CmxCapabilityExecutionFailure
