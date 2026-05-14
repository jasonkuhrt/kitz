import { expect } from 'bun:test'
import { Prompter } from '../../../lib/Prompter/_.js'

export type MemoryPrompter = Prompter.MemoryPrompter

export const createMemoryPrompter = (): MemoryPrompter => Prompter.createMemoryPrompter()

export const expectMemoryPrompterDrained = (memoryPrompter: MemoryPrompter) => {
  expect(memoryPrompter.answers.get()).toEqual([])
}
