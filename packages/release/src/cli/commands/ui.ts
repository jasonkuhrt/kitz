import { Oak } from '@kitz/oak'
import { Tui } from '@kitz/tui'
import { Effect } from 'effect'
import { createElement } from 'react'
import { Dashboard } from './ui-app.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Open the interactive release dashboard UI')
  .parse()

void args

Effect.runPromise(Tui.runApp(createElement(Dashboard))).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
