import { Effect, Schema } from 'effect'
import { Linter } from '@kitz/linter'

const EmptyInput = Schema.Struct({})

const FloDoctorCommand = Schema.Struct({
  key: Schema.String,
  configured: Schema.String,
  executable: Schema.String,
  available: Schema.Boolean,
})

const FloDoctorOutput = Schema.Struct({
  configPath: Schema.String,
  configExists: Schema.Boolean,
  currentDirectory: Schema.String,
  cmuxAvailable: Schema.Boolean,
  currentProject: Schema.NullOr(
    Schema.Struct({
      name: Schema.String,
      path: Schema.String,
    }),
  ),
  currentCheckout: Schema.NullOr(
    Schema.Struct({
      path: Schema.String,
      branch: Schema.NullOr(Schema.String),
      isMain: Schema.Boolean,
    }),
  ),
  commands: Schema.Array(FloDoctorCommand),
})

type FloDoctorOutput = typeof FloDoctorOutput.Type

const loadFloDoctor = (cwd: string): Effect.Effect<FloDoctorOutput> =>
  Effect.succeed({
    configPath: `${cwd}/.flo/config.json`,
    configExists: true,
    currentDirectory: cwd,
    cmuxAvailable: true,
    currentProject: {
      name: 'kitz',
      path: '/Users/jasonkuhrt/projects/jasonkuhrt/kitz',
    },
    currentCheckout: {
      path: '/Users/jasonkuhrt/projects/jasonkuhrt/kitz',
      branch: 'main',
      isMain: true,
    },
    commands: [
      { key: 'git', configured: 'git', executable: '/opt/homebrew/bin/git', available: true },
      { key: 'cmux', configured: 'cmux', executable: '/opt/homebrew/bin/cmux', available: true },
      {
        key: 'claude',
        configured: 'claude',
        executable: '/opt/homebrew/bin/claude',
        available: true,
      },
    ],
  })

export const FloDoctor = Linter.create('flo')
  .service('cwd', Schema.String)
  .program(
    Linter.probeProgram('doctor')
      .input(EmptyInput)
      .output(FloDoctorOutput)
      .collect(({ services }) => loadFloDoctor(services.cwd)),
  )
  .build()

export const runFloDoctor = (cwd: string) =>
  FloDoctor.run({
    program: 'doctor',
    input: {},
    services: { cwd },
  })
