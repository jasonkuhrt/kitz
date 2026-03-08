import { Effect, Schema } from 'effect'
import { Finding, Linter } from '@kitz/linter'

const DoctorInput = Schema.Struct({
  yamlPath: Schema.optional(Schema.String),
})

const Target = Schema.Struct({
  browser: Schema.Literal('safari', 'chrome'),
  displayName: Schema.String,
  path: Schema.String,
  requiresFullDiskAccess: Schema.Boolean,
  browserProcessName: Schema.String,
})

const BookmarksConfig = Schema.Struct({
  yamlPath: Schema.String,
  configuredChromeProfiles: Schema.Array(Schema.String),
})

type Target = typeof Target.Type
type BookmarksConfig = typeof BookmarksConfig.Type

const loadConfig = (yamlPath: string): Effect.Effect<BookmarksConfig> =>
  Effect.succeed({
    yamlPath,
    configuredChromeProfiles: ['Default'],
  })

const discoverTargets = (): Effect.Effect<readonly Target[]> =>
  Effect.succeed([
    {
      browser: 'safari',
      displayName: 'Safari',
      path: '/Users/jasonkuhrt/Library/Safari/Bookmarks.plist',
      requiresFullDiskAccess: true,
      browserProcessName: 'Safari',
    },
    {
      browser: 'chrome',
      displayName: 'Chrome Default',
      path: '/Users/jasonkuhrt/Library/Application Support/Google/Chrome/Default/Bookmarks',
      requiresFullDiskAccess: false,
      browserProcessName: 'Google Chrome',
    },
  ])

const checkFullDiskAccess = (): Effect.Effect<boolean> => Effect.succeed(true)
const checkBrowserRunning = (_name: string): Effect.Effect<boolean> => Effect.succeed(false)
const targetExists = (_path: string): Effect.Effect<boolean> => Effect.succeed(true)

export const BookmarksDoctor = Linter.create('bookmarks')
  .service('cwd', Schema.String)
  .fact('config', BookmarksConfig)
  .fact('targets', Schema.Array(Target))
  .rule(
    Linter.rule('config.yaml-valid')
      .group('config')
      .describe('bookmarks.yaml parses successfully')
      .run(({ facts }) =>
        Effect.succeed([
          Finding.pass({
            code: 'config.yaml-valid',
            message: `bookmarks.yaml is valid at ${facts.config.yamlPath}`,
          }),
        ]),
      ),
  )
  .rule(
    Linter.rule('targets.enabled')
      .group('targets')
      .describe('at least one bookmark target is enabled')
      .run(({ facts }) =>
        facts.targets.length > 0
          ? Effect.succeed([
              Finding.pass({
                code: 'targets.enabled',
                message: `found ${facts.targets.length} enabled targets`,
              }),
            ])
          : Effect.succeed([
              Finding.fail({
                code: 'targets.enabled',
                message: 'No enabled bookmark targets were discovered.',
                fix: {
                  kind: 'guide',
                  summary: 'Enable at least one browser target in bookmarks.yaml.',
                  steps: [
                    'Add safari or chrome under targets in bookmarks.yaml',
                    'Create the browser profile locally before syncing',
                  ],
                },
              }),
            ]),
      ),
  )
  .rule(
    Linter.rule('targets.full-disk-access')
      .group('permissions')
      .describe('Safari targets have Full Disk Access available')
      .run(({ facts }) =>
        Effect.gen(function* () {
          const needsAccess = facts.targets.some((target) => target.requiresFullDiskAccess)
          if (!needsAccess) return []

          const ok = yield* checkFullDiskAccess()
          return ok
            ? [
                Finding.pass({
                  code: 'targets.full-disk-access',
                  message: 'Terminal has Full Disk Access for Safari targets.',
                }),
              ]
            : [
                Finding.fail({
                  code: 'targets.full-disk-access',
                  message: 'Terminal lacks Full Disk Access for Safari targets.',
                  fix: {
                    kind: 'guide',
                    summary: 'Enable Full Disk Access for your terminal app.',
                    steps: [
                      'Open System Settings',
                      'Go to Privacy & Security > Full Disk Access',
                      'Enable your terminal app',
                    ],
                  },
                }),
              ]
        }),
      ),
  )
  .rule(
    Linter.rule('targets.discovered')
      .group('targets')
      .describe('all discovered targets exist on disk')
      .run(({ facts }) =>
        Effect.forEach(facts.targets, (target) =>
          Effect.gen(function* () {
            const exists = yield* targetExists(target.path)
            return exists
              ? Finding.pass({
                  code: 'targets.discovered',
                  message: `${target.displayName} exists at ${target.path}`,
                })
              : Finding.fail({
                  code: 'targets.discovered',
                  message: `${target.displayName} was not found at ${target.path}`,
                  fix: {
                    kind: 'guide',
                    summary: 'Restore or recreate the browser profile.',
                    steps: [
                      `Check the file at ${target.path}`,
                      `Recreate the ${target.displayName} profile if needed`,
                    ],
                  },
                })
          }),
        ),
      ),
  )
  .rule(
    Linter.rule('targets.browser-not-running')
      .group('runtime')
      .describe('target browsers are closed before sync')
      .run(({ facts }) =>
        Effect.forEach(
          [...new Set(facts.targets.map((target) => target.browserProcessName))],
          (browserName) =>
            Effect.gen(function* () {
              const running = yield* checkBrowserRunning(browserName)
              return running
                ? Finding.fail({
                    code: 'targets.browser-not-running',
                    message: `${browserName} is currently running.`,
                    fix: {
                      kind: 'guide',
                      summary: `Close ${browserName} before syncing.`,
                      steps: [`Quit ${browserName}`],
                    },
                  })
                : Finding.pass({
                    code: 'targets.browser-not-running',
                    message: `${browserName} is not running.`,
                  })
            }),
        ),
      ),
  )
  .program(
    Linter.auditProgram('doctor')
      .input(DoctorInput)
      .collect(({ input, services }) =>
        Effect.gen(function* () {
          const yamlPath = input.yamlPath ?? `${services.cwd}/bookmarks.yaml`
          const [config, targets] = yield* Effect.all([loadConfig(yamlPath), discoverTargets()])
          return { config, targets }
        }),
      )
      .use('config.yaml-valid')
      .use('targets.enabled')
      .use('targets.full-disk-access')
      .use('targets.discovered')
      .use('targets.browser-not-running'),
  )
  .build()

export const runBookmarksDoctor = (cwd: string, yamlPath?: string) =>
  BookmarksDoctor.run({
    program: 'doctor',
    mode: 'check',
    input: { yamlPath },
    services: { cwd },
  })
