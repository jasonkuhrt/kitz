import { Effect, Schema } from 'effect'
import { Finding, Linter } from '@kitz/linter'

const EmptyInput = Schema.Struct({})

const ConfigState = Schema.Struct({
  configFound: Schema.Boolean,
  ruleCount: Schema.Number,
  formatterDetected: Schema.NullOr(Schema.String),
})

const LintState = Schema.Struct({
  staleIndexFiles: Schema.Array(Schema.String),
  namespaceCollisions: Schema.Array(Schema.String),
  unmanagedDirectories: Schema.Array(Schema.String),
})

type ConfigState = typeof ConfigState.Type
type LintState = typeof LintState.Type

const loadConfigState = (_cwd: string): Effect.Effect<ConfigState> =>
  Effect.succeed({
    configFound: true,
    ruleCount: 2,
    formatterDetected: 'prettier',
  })

const loadLintState = (_cwd: string): Effect.Effect<LintState> =>
  Effect.succeed({
    staleIndexFiles: ['src/foo/_.ts'],
    namespaceCollisions: [],
    unmanagedDirectories: ['src/features/payments'],
  })

const regenerateIndexFiles = (_cwd: string): Effect.Effect<void> => Effect.void

export const CrossmodDoctor = Linter.create('crossmod')
  .service('cwd', Schema.String)
  .fact('configState', ConfigState)
  .fact('lintState', LintState)
  .rule(
    Linter.rule('setup.config-exists')
      .group('setup')
      .describe('config file exists')
      .run(({ facts }) =>
        facts.configState.configFound
          ? Effect.succeed([
              Finding.pass({
                code: 'setup.config-exists',
                message: `Config valid (${facts.configState.ruleCount} rules)`,
              }),
            ])
          : Effect.succeed([
              Finding.fail({
                code: 'setup.config-exists',
                message: 'No config file found.',
                fix: {
                  kind: 'command',
                  summary: 'Initialize a config file.',
                  command: 'madmod init',
                },
              }),
            ]),
      ),
  )
  .rule(
    Linter.rule('environment.formatter-detected')
      .group('environment')
      .describe('formatter is available when formatting is enabled')
      .run(({ facts }) =>
        facts.configState.formatterDetected
          ? Effect.succeed([
              Finding.pass({
                code: 'environment.formatter-detected',
                message: `Formatter: ${facts.configState.formatterDetected}`,
              }),
            ])
          : Effect.succeed([
              Finding.warn({
                code: 'environment.formatter-detected',
                message: "No formatter detected; generated files won't be auto-formatted.",
              }),
            ]),
      ),
  )
  .rule(
    Linter.rule('lint.index-files-fresh')
      .group('lint')
      .describe('managed index files are up to date')
      .run(({ facts }) =>
        facts.lintState.staleIndexFiles.length === 0
          ? Effect.succeed([
              Finding.pass({
                code: 'lint.index-files-fresh',
                message: 'all managed index files are up to date',
              }),
            ])
          : Effect.succeed(
              facts.lintState.staleIndexFiles.map((path) =>
                Finding.fail({
                  code: 'lint.index-files-fresh',
                  message: `${path} is stale`,
                  safeFix: ({ services }) => regenerateIndexFiles(services.cwd),
                }),
              ),
            ),
      ),
  )
  .rule(
    Linter.rule('lint.namespace-collisions')
      .group('lint')
      .describe('namespace exports do not collide')
      .run(({ facts }) =>
        facts.lintState.namespaceCollisions.length === 0
          ? Effect.succeed([
              Finding.pass({
                code: 'lint.namespace-collisions',
                message: 'No namespace collisions',
              }),
            ])
          : Effect.succeed(
              facts.lintState.namespaceCollisions.map((message) =>
                Finding.fail({
                  code: 'lint.namespace-collisions',
                  message,
                }),
              ),
            ),
      ),
  )
  .rule(
    Linter.rule('suggest.unmanaged-directories')
      .group('suggestion')
      .describe('directories with unmanaged barrels are suggested for rule coverage')
      .run(({ facts }) =>
        Effect.succeed(
          facts.lintState.unmanagedDirectories.map((directory) =>
            Finding.suggest({
              code: 'suggest.unmanaged-directories',
              message: `${directory} contains source files but is not managed by any rule`,
            }),
          ),
        ),
      ),
  )
  .program(
    Linter.auditProgram('doctor')
      .input(EmptyInput)
      .collect(({ services }) =>
        Effect.all({
          configState: loadConfigState(services.cwd),
          lintState: loadLintState(services.cwd),
        }),
      )
      .use('setup.config-exists')
      .use('environment.formatter-detected')
      .use('lint.index-files-fresh')
      .use('lint.namespace-collisions')
      .use('suggest.unmanaged-directories'),
  )
  .build()

export const runCrossmodDoctor = (cwd: string, fix: boolean) =>
  CrossmodDoctor.run({
    program: 'doctor',
    mode: fix ? 'fix' : 'check',
    input: {},
    services: { cwd },
  })
