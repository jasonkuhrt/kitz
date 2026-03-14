import { Effect, Schema } from 'effect'
import { Finding, Linter } from '@kitz/linter'

// This example turns Polen's existing diagnostics systems into a single doctor-like audit surface.

const DoctorInput = Schema.Struct({
  projectDir: Schema.String,
  phase: Schema.Literals(['dev', 'build']),
})

const Diagnostic = Schema.Struct({
  source: Schema.String,
  name: Schema.String,
  severity: Schema.Literals(['info', 'warning', 'error']),
  message: Schema.String,
})

type Diagnostic = typeof Diagnostic.Type

const ExamplesDiagnostics = Schema.Array(Diagnostic)
const ReferenceDiagnostics = Schema.Array(Diagnostic)
const FileRouterDiagnostics = Schema.Array(Diagnostic)

const scanExamples = (_projectDir: string): Effect.Effect<readonly Diagnostic[]> =>
  Effect.succeed([
    {
      source: 'examples-scanner',
      name: 'missing-versions',
      severity: 'warning',
      message: 'Query examples are missing explicit version coverage.',
    },
  ])

const scanReference = (_projectDir: string): Effect.Effect<readonly Diagnostic[]> =>
  Effect.succeed([])

const scanFileRouter = (_projectDir: string): Effect.Effect<readonly Diagnostic[]> =>
  Effect.succeed([
    {
      source: 'file-router',
      name: 'index-conflict',
      severity: 'error',
      message: 'Literal route conflicts with index route ordering.',
    },
  ])

const toFindings = (codePrefix: string, diagnostics: readonly Diagnostic[]) =>
  diagnostics.map((diagnostic) =>
    diagnostic.severity === 'error'
      ? Finding.fail({
          code: `${codePrefix}.${diagnostic.name}`,
          message: diagnostic.message,
        })
      : diagnostic.severity === 'warning'
        ? Finding.warn({
            code: `${codePrefix}.${diagnostic.name}`,
            message: diagnostic.message,
          })
        : Finding.pass({
            code: `${codePrefix}.${diagnostic.name}`,
            message: diagnostic.message,
          }),
  )

export const PolenDiagnostics = Linter.create('polen')
  .fact('examplesDiagnostics', ExamplesDiagnostics)
  .fact('referenceDiagnostics', ReferenceDiagnostics)
  .fact('fileRouterDiagnostics', FileRouterDiagnostics)
  .rule(
    Linter.rule('examples.scan')
      .group('examples')
      .describe('example documents are structurally valid')
      .run(({ facts }) => Effect.succeed(toFindings('examples', facts.examplesDiagnostics))),
  )
  .rule(
    Linter.rule('reference.scan')
      .group('reference')
      .describe('reference content scans cleanly')
      .run(({ facts }) => Effect.succeed(toFindings('reference', facts.referenceDiagnostics))),
  )
  .rule(
    Linter.rule('router.scan')
      .group('router')
      .describe('file router invariants hold')
      .run(({ facts }) => Effect.succeed(toFindings('router', facts.fileRouterDiagnostics))),
  )
  .program(
    Linter.auditProgram('project.doctor')
      .input(DoctorInput)
      .collect(({ input }) =>
        Effect.all({
          examplesDiagnostics: scanExamples(input.projectDir),
          referenceDiagnostics: scanReference(input.projectDir),
          fileRouterDiagnostics: scanFileRouter(input.projectDir),
        }),
      )
      .use('examples.scan')
      .use('reference.scan')
      .use('router.scan'),
  )
  .build()

export const runPolenProjectDoctor = (projectDir: string, phase: 'dev' | 'build') =>
  PolenDiagnostics.run({
    program: 'project.doctor',
    mode: 'check',
    input: { projectDir, phase },
    config: {
      rules: {
        'examples.scan': {
          severity: 'warn',
        },
      },
    },
  })
