/**
 * Example showing pretty terminal output mode.
 * Run with: LOG_PRETTY=true bun examples/log-example-pretty.ts
 */

import { Log } from '../src/log/_.js'

// Force pretty mode
const log = Log.create({ pretty: true })

console.log('\n=== Basic Logging ===\n')
log.info(`Application started`)
log.debug(`Configuration loaded`, { port: 3000, host: `localhost` })
log.warn(`Deprecated API usage detected`)

console.log('\n=== Hierarchical Logging ===\n')
const appLog = log.child(`app`)
const routerLog = appLog.child(`router`)

appLog.info(`App module initialized`)
routerLog.debug(`Route registered`, { path: `/users/:id`, method: `GET` })
routerLog.info(`Handling request`, { params: { id: `123` } })

console.log('\n=== Context Propagation ===\n')
const requestLog = log.child(`request`)
requestLog.addToContext({ requestId: `abc123`, userId: `user456` })
requestLog.info(`Processing request`)
requestLog.debug(`Cache miss`)
requestLog.debug(`Database query`, { duration: 45, rows: 10 })

console.log('\n=== All Log Levels ===\n')
log.trace(`Detailed trace information`)
log.debug(`Debug information`)
log.info(`General information`)
log.warn(`Warning message`)
log.error(`Error occurred`, { error: new Error(`Something failed`) })
log.fatal(`Critical failure`)
