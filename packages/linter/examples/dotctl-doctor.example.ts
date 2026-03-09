import { Effect, Schema } from 'effect'
import { Finding, Linter } from '@kitz/linter'

const DoctorInput = Schema.Struct({
  showPass: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  render: Schema.optional(Schema.Literal('focus', 'sectioned', 'compact', 'table', 'tree')),
})

const ManifestState = Schema.Struct({
  exists: Schema.Boolean,
  staleTargets: Schema.Array(Schema.String),
})

const DeploymentPlan = Schema.Struct({
  warnings: Schema.Array(Schema.String),
  symlinkDirEntries: Schema.Number,
})

const RepoHealth = Schema.Struct({
  brokenSymlinks: Schema.Array(Schema.String),
  orphanedSymlinks: Schema.Array(Schema.String),
  currentBranch: Schema.String,
})

type DoctorInput = typeof DoctorInput.Type
type ManifestState = typeof ManifestState.Type
type DeploymentPlan = typeof DeploymentPlan.Type
type RepoHealth = typeof RepoHealth.Type

const loadManifestState = (_cwd: string): Effect.Effect<ManifestState> =>
  Effect.succeed({
    exists: true,
    staleTargets: [],
  })

const buildPlan = (_cwd: string): Effect.Effect<DeploymentPlan> =>
  Effect.succeed({
    warnings: [],
    symlinkDirEntries: 14,
  })

const loadRepoHealth = (_cwd: string): Effect.Effect<RepoHealth> =>
  Effect.succeed({
    brokenSymlinks: [],
    orphanedSymlinks: ['~/.old-dotfiles-link'],
    currentBranch: 'main',
  })

export const DotctlDoctor = Linter.create('dotctl')
  .service('cwd', Schema.String)
  .fact('manifest', ManifestState)
  .fact('plan', DeploymentPlan)
  .fact('repo', RepoHealth)
  .rule(
    Linter.rule('plan.convention')
      .group('plan')
      .priority(10)
      .describe('convention plan dry-run is clean')
      .run(({ facts }) =>
        facts.plan.warnings.length === 0
          ? Effect.succeed([
              Finding.pass({
                code: 'plan.convention',
                message: `plan ok (${facts.plan.symlinkDirEntries} managed directory entries)`,
              }),
            ])
          : Effect.succeed([
              Finding.fail({
                code: 'plan.convention',
                message: facts.plan.warnings.join('; '),
              }),
            ]),
      ),
  )
  .rule(
    Linter.rule('manifest.exists')
      .group('manifest')
      .priority(20)
      .describe('manifest exists before manifest-based checks run')
      .run(({ facts }) =>
        facts.manifest.exists
          ? Effect.succeed([
              Finding.pass({
                code: 'manifest.exists',
                message: 'manifest present',
              }),
            ])
          : Effect.succeed([
              Finding.skip({
                code: 'manifest.exists',
                message: 'manifest missing; downstream manifest checks are skipped',
              }),
            ]),
      ),
  )
  .rule(
    Linter.rule('manifest.freshness')
      .group('manifest')
      .priority(30)
      .describe('manifest matches deployed state')
      .run(({ facts }) =>
        facts.manifest.staleTargets.length === 0
          ? Effect.succeed([
              Finding.pass({
                code: 'manifest.freshness',
                message: 'manifest matches deployed state',
              }),
            ])
          : Effect.succeed([
              Finding.warn({
                code: 'manifest.freshness',
                message: `manifest drift detected for ${facts.manifest.staleTargets.join(', ')}`,
              }),
            ]),
      ),
  )
  .rule(
    Linter.rule('repo.broken-symlinks')
      .group('repo')
      .priority(40)
      .describe('managed symlinks are not broken')
      .run(({ facts }) =>
        facts.repo.brokenSymlinks.length === 0
          ? Effect.succeed([
              Finding.pass({
                code: 'repo.broken-symlinks',
                message: 'no broken symlinks',
              }),
            ])
          : Effect.succeed([
              Finding.fail({
                code: 'repo.broken-symlinks',
                message: `broken symlinks: ${facts.repo.brokenSymlinks.join(', ')}`,
              }),
            ]),
      ),
  )
  .rule(
    Linter.rule('repo.orphaned-symlinks')
      .group('repo')
      .priority(50)
      .describe('orphaned repo symlinks are highlighted as warnings')
      .run(({ facts }) =>
        facts.repo.orphanedSymlinks.length === 0
          ? Effect.succeed([
              Finding.pass({
                code: 'repo.orphaned-symlinks',
                message: 'no orphaned symlinks',
              }),
            ])
          : Effect.succeed([
              Finding.warn({
                code: 'repo.orphaned-symlinks',
                message: `orphaned symlinks: ${facts.repo.orphanedSymlinks.join(', ')}`,
              }),
            ]),
      ),
  )
  .program(
    Linter.auditProgram('doctor')
      .input(DoctorInput)
      .collect(({ services }) =>
        Effect.all({
          manifest: loadManifestState(services.cwd),
          plan: buildPlan(services.cwd),
          repo: loadRepoHealth(services.cwd),
        }),
      )
      .view({
        default: 'focus',
        supported: ['focus', 'sectioned', 'compact', 'table', 'tree'],
      })
      .use('plan.convention')
      .use('manifest.exists')
      .use('manifest.freshness')
      .use('repo.broken-symlinks')
      .use('repo.orphaned-symlinks'),
  )
  .build()

export const runDotctlDoctor = (cwd: string, input: DoctorInput) =>
  DotctlDoctor.run({
    program: 'doctor',
    mode: 'check',
    input,
    services: { cwd },
  })
