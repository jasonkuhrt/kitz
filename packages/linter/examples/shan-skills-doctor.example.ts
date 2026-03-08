import { Effect, Schema } from 'effect'
import { Finding, Linter } from '@kitz/linter'

const DoctorInput = Schema.Struct({
  scope: Schema.Literal('project', 'user'),
})

const SkillState = Schema.Struct({
  brokenSymlinks: Schema.Array(Schema.String),
  staleRouters: Schema.Array(Schema.String),
  staleGitignoreEntries: Schema.Array(Schema.String),
})

type SkillState = typeof SkillState.Type

const loadSkillState = (_scope: 'project' | 'user'): Effect.Effect<SkillState> =>
  Effect.succeed({
    brokenSymlinks: ['skills/graphql-router'],
    staleRouters: ['skills/router.ts'],
    staleGitignoreEntries: ['.claude/skills/project/old-skill'],
  })

const restoreSymlink = (_name: string): Effect.Effect<void> => Effect.void
const regenerateRouter = (_name: string): Effect.Effect<void> => Effect.void
const rewriteGitignore = (_entries: readonly string[]): Effect.Effect<void> => Effect.void
const saveDoctorHistory = (_scope: string, _appliedFixes: readonly string[]): Effect.Effect<void> =>
  Effect.void

export const ShanSkillsDoctor = Linter.create('shan.skills')
  .fact('skillState', SkillState)
  .rule(
    Linter.rule('skills.broken-symlinks')
      .group('state')
      .describe('installed skills point at valid targets')
      .run(({ facts }) =>
        Effect.succeed(
          facts.skillState.brokenSymlinks.map((name) =>
            Finding.fail({
              code: 'skills.broken-symlinks',
              message: `${name} points at a missing target`,
              safeFix: () => restoreSymlink(name),
            }),
          ),
        ),
      ),
  )
  .rule(
    Linter.rule('skills.stale-routers')
      .group('router')
      .describe('generated skill routers match current library state')
      .run(({ facts }) =>
        Effect.succeed(
          facts.skillState.staleRouters.map((name) =>
            Finding.fail({
              code: 'skills.stale-routers',
              message: `${name} is stale`,
              safeFix: () => regenerateRouter(name),
            }),
          ),
        ),
      ),
  )
  .rule(
    Linter.rule('skills.stale-gitignore')
      .group('repo')
      .describe('gitignore entries match installed skills')
      .run(({ facts }) =>
        facts.skillState.staleGitignoreEntries.length === 0
          ? Effect.succeed([])
          : Effect.succeed([
              Finding.fail({
                code: 'skills.stale-gitignore',
                message: 'gitignore contains stale skill entries',
                safeFix: () => rewriteGitignore(facts.skillState.staleGitignoreEntries),
              }),
            ]),
      ),
  )
  .program(
    Linter.auditProgram('doctor')
      .input(DoctorInput)
      .collect(({ input }) =>
        Effect.all({
          skillState: loadSkillState(input.scope),
        }),
      )
      .use('skills.broken-symlinks')
      .use('skills.stale-routers')
      .use('skills.stale-gitignore'),
  )
  .build()

export const runShanSkillsDoctor = (scope: 'project' | 'user', noFix: boolean) =>
  Effect.gen(function* () {
    const result = yield* ShanSkillsDoctor.run({
      program: 'doctor',
      mode: noFix ? 'check' : 'fix',
      input: { scope },
    })

    if (!noFix && result.appliedFixes.length > 0) {
      yield* saveDoctorHistory(
        scope,
        result.appliedFixes.map((fix) => fix.summary),
      )
    }

    return result
  })
