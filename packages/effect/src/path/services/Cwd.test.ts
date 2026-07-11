import { describe, expect, it, vi } from '@kitz/vitest'
import { Cause, Effect, Exit } from 'effect'
import { Cwd } from './Cwd.js'

describe('Cwd', () => {
  it('reports process cwd failures through a typed CwdError', async () => {
    const cwd = vi.spyOn(process, 'cwd').mockImplementation(() => {
      throw new Error('cwd unavailable')
    })

    try {
      const exit = await Effect.runPromiseExit(Effect.provide(Cwd, Cwd.layer))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const reason = exit.cause.reasons[0]
        expect(reason !== undefined && Cause.isFailReason(reason)).toBe(true)
        if (reason !== undefined && Cause.isFailReason(reason)) {
          expect(reason.error).toMatchObject({ _tag: '@kitz/effect/Path/CwdError' })
        }
      }
    } finally {
      cwd.mockRestore()
    }
  })
})
