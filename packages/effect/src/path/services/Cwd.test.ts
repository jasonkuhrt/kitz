import { describe, expect, expectTypeOf, it, vi } from '@kitz/vitest'
import { Cause, Effect, Exit, Layer } from 'effect'
import { Cwd, CwdError } from './Cwd.js'

const expectCwdError = async (): Promise<CwdError> => {
  const exit = await Effect.runPromiseExit(Effect.provide(Cwd, Cwd.layer))

  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isSuccess(exit)) throw new Error('Expected Cwd.layer to fail')

  const reason = exit.cause.reasons[0]
  expect(reason !== undefined && Cause.isFailReason(reason)).toBe(true)
  if (reason === undefined || !Cause.isFailReason(reason)) {
    throw new Error('Expected Cwd.layer to fail through its typed error channel')
  }

  expect(reason.error).toBeInstanceOf(CwdError)
  expect(reason.error).toMatchObject({ _tag: '@kitz/effect/Path/CwdError' })
  if (!(reason.error instanceof CwdError)) throw new Error('Expected a CwdError')
  return reason.error
}

describe('Cwd', () => {
  it('exposes CwdError in the layer error channel', () => {
    expectTypeOf(Cwd.layer).toEqualTypeOf<Layer.Layer<Cwd, CwdError, never>>()
  })

  it('reports process cwd failures through a typed CwdError', async () => {
    const failure = new Error('cwd unavailable')
    const cwd = vi.spyOn(process, 'cwd').mockImplementation(() => {
      throw failure
    })

    try {
      expect((await expectCwdError()).cause).toBe(failure)
    } finally {
      cwd.mockRestore()
    }
  })

  it('maps invalid cwd decoding into the same CwdError channel', async () => {
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/\0invalid')

    try {
      expect((await expectCwdError()).cause).toBeDefined()
    } finally {
      cwd.mockRestore()
    }
  })
})
