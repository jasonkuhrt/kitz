import { Fs } from '@kitz/fs'
import { Effect } from 'effect'

export const prepareRelease = (artifact: Fs.Path.AbsFile) =>
  Effect.gen(function* () {
    const exists = yield* Fs.exists(artifact)
    if (!exists) return null
    return yield* Fs.read(artifact)
  })
