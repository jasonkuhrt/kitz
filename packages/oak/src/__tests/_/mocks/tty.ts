import { afterEach, beforeEach, expect } from 'bun:test'
import { Prompter } from '../../../lib/Prompter/_.js'

export let memoryPrompter: Prompter.MemoryPrompter

beforeEach(() => {
  memoryPrompter = Prompter.createMemoryPrompter()
})

afterEach(() => {
  expect(memoryPrompter.answers.get()).toEqual([])
})
