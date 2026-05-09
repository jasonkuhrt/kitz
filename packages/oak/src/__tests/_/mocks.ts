import { beforeEach, vi, spyOn } from 'bun:test'

export let exit: ReturnType<typeof spyOn>

beforeEach(() => {
  exit = vi.spyOn(process, `exit`).mockImplementation(() => undefined as never)
})
