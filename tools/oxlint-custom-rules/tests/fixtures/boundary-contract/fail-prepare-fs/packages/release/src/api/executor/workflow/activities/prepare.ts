import { Effect } from 'effect'
import fs from 'node:fs/promises'

export const prepareRelease = (artifactPath: string) =>
  Effect.promise(async () => {
    const bytes = await fs.readFile(artifactPath)
    return bytes.length
  })
