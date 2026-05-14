export class PublishingCapabilityError extends Error {
  readonly _tag = 'PublishingCapabilityError'

  constructor(
    message: string,
    readonly context: {
      readonly provider: string
      readonly operation: string
    },
  ) {
    super(message)
  }
}
