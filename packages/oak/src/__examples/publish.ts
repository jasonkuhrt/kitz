import { z } from 'zod/v4'
import { Command } from '../__.js'
import { Zod } from '../_entrypoints/extensions.js'

const args = Command.create()
  .use(Zod)
  .parameter(`githubToken`, z.string())
  .parameter(`publish`, z.boolean().default(true))
  .parameter(`githubRelease`, z.boolean().default(true))
  .parameter(`p package`, z.enum([`@wollybeard/oak`]))
  .parametersExclusive(`method`, (__: any) =>
    __.parameter(`v version`, z.string().regex(/^\d+\.\d+\.\d+$/)).parameter(
      `b bump`,
      z.enum([`major`, `minor`, `patch`]),
    ),
  )
  .settings({
    parameters: {
      environment: {
        githubToken: { prefix: false },
      },
    },
  })
  .parse()

args[`method`]
