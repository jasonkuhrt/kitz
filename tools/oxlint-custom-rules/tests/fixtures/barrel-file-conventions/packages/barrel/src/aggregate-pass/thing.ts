export interface Thing {
  readonly id: string
}

export const thing = { id: 'ok' } satisfies Thing
