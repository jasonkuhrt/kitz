export * as PipelineDefinition from './__.js'

/** JSDoc target for the PipelineDefinition namespace export. */
export interface PipelineDefinition {
  readonly config: import('./Config.js').Config
  readonly input: object
  readonly steps: readonly import('../StepDefinition.js').StepDefinition[]
  readonly overloads: readonly import('../Overload/_.js').Data[]
}
