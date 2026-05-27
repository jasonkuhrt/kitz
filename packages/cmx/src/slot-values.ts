import { Effect, Layer, Context } from 'effect'

/** Consumer-provided Layer whose service type is erased at storage boundaries. */
type AnyLayer = Layer.Layer<any>

/**
 * Capability-scoped service that provides filled slot values at execution time.
 *
 * Each capability sees only the slots it declared, not other capabilities' slots.
 * The values are provided by cmx when building the execution Effect from a
 * fully-resolved command.
 *
 * Usage inside a capability:
 * ```typescript
 * const exportCap = Cmx.Capability.make({
 *   name: 'export',
 *   slots: [formatSlot],
 *   execute: Effect.gen(function*() {
 *     const { format } = yield* SlotValues
 *     yield* exportToFile(format)
 *   }),
 * })
 * ```
 */
export class SlotValues extends Context.Service<SlotValues, Readonly<Record<string, unknown>>>()(
  'cmx/SlotValues',
) {}

/**
 * Create a Layer that provides slot values for a capability's execution.
 * Called by the Session when building the executable Effect.
 */
export const makeSlotValuesLayer = (
  values: Readonly<Record<string, unknown>>,
): Layer.Layer<SlotValues> => Layer.succeed(SlotValues)(values)

/**
 * Build the executable Effect for a capability by providing its slot values.
 * Wraps the capability's execute Effect with the SlotValues layer.
 */
export const buildExecutableEffect = (
  execute: Effect.Effect<void>,
  slotValues: Readonly<Record<string, unknown>>,
  additionalLayers?: AnyLayer,
): Effect.Effect<void> => {
  const slotLayer = makeSlotValuesLayer(slotValues)
  const combinedLayer = additionalLayers ? Layer.merge(slotLayer, additionalLayers) : slotLayer
  return Effect.provide(execute, combinedLayer)
}
