import { describe, expect, test } from 'bun:test'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Effect, Layer } from 'effect'
import { sha256Json } from './digest.js'
import { journalPathFor, makeEntry, writeEntries } from './journal.js'
import { Official } from './planner/models/item-official.js'
import { Plan } from './planner/models/plan.js'
import {
  classify,
  inspectVerdict,
  journalSubjects,
  reconcile,
  registrySubjects,
} from './reconciler.js'
import { PlanDigest } from './release-contract.js'
import { OfficialFirst } from './version/models/official-first.js'

const digest = PlanDigest.make(sha256Json({ plan: 'reconcile' }))

describe('release reconciliation classifier', () => {
  test('classifies clean state when journal and registry match the plan', () => {
    const decision = classify({
      planDigest: digest,
      plannedSubjects: ['@kitz/core@1.0.0'],
      journalSubjects: ['@kitz/core@1.0.0'],
      registrySubjects: ['@kitz/core@1.0.0'],
    })

    expect(decision.classification).toBe('clean')
    expect(decision.nextCommand).toBe('none')
  })

  test('classifies repair when registry succeeded but journal missed it', () => {
    const decision = classify({
      planDigest: digest,
      plannedSubjects: ['@kitz/core@1.0.0'],
      journalSubjects: [],
      registrySubjects: ['@kitz/core@1.0.0'],
    })

    expect(decision.classification).toBe('repair')
    expect(decision.nextCommand).toBe('release repair --action record-remote-success')
  })

  test('classifies abort when journal and registry disagree after a claimed mutation', () => {
    const decision = classify({
      planDigest: digest,
      plannedSubjects: ['@kitz/core@1.0.0'],
      journalSubjects: ['@kitz/core@1.0.0'],
      registrySubjects: [],
    })

    expect(decision.classification).toBe('abort')
    expect(decision.nextCommand).toBe('release repair --action manual-intervention')
  })

  test('classifies resume when planned subjects are still missing from registry', () => {
    const decision = classify({
      planDigest: digest,
      plannedSubjects: ['@kitz/core@1.0.0', '@kitz/cli@1.0.0'],
      journalSubjects: [],
      registrySubjects: ['@kitz/core@1.0.0'],
    })

    expect(decision.classification).toBe('resume')
    expect(decision.nextCommand).toBe('release resume')
    expect(decision.stateDiff).toEqual(['registry is missing @kitz/cli@1.0.0'])
  })

  test('extracts only succeeded registry publish subjects from the journal', () => {
    const entries = [
      makeEntry({
        planDigest: digest,
        kind: 'registry-publish',
        subject: '@kitz/core@1.0.0',
        planned: {},
        result: 'attempting',
        attemptedAt: '2026-05-14T00:00:00.000Z',
      }),
      makeEntry({
        planDigest: digest,
        kind: 'registry-publish',
        subject: '@kitz/core@1.0.0',
        planned: {},
        result: 'succeeded',
        attemptedAt: '2026-05-14T00:00:01.000Z',
      }),
      makeEntry({
        planDigest: digest,
        kind: 'git-tag-push',
        subject: '@kitz/core@1.0.0',
        planned: {},
        result: 'succeeded',
        attemptedAt: '2026-05-14T00:00:02.000Z',
      }),
    ]

    expect(journalSubjects(entries)).toEqual(['@kitz/core@1.0.0'])
  })

  test('classifies invalid journal hash chains as abort without a mutation command', () => {
    const decision = classify({
      planDigest: digest,
      plannedSubjects: ['@kitz/core@1.0.0'],
      journalSubjects: ['@kitz/core@1.0.0'],
      registrySubjects: ['@kitz/core@1.0.0'],
      journalValid: false,
    })

    expect(decision.classification).toBe('abort')
    expect(decision.nextCommand).toBe('none')
    expect(decision.stateDiff).toEqual(['execution journal hash chain is invalid'])
  })

  test('computes inspect legitimacy verdicts from journal and registry evidence', () => {
    expect(inspectVerdict({ onRegistry: true, inJournal: true })).toBe('registry-matches-journal')
    expect(inspectVerdict({ onRegistry: false, inJournal: true })).toBe(
      'registry-disagrees-with-journal',
    )
    expect(inspectVerdict({ onRegistry: true, inJournal: false })).toBe(
      'not-in-journal-but-on-registry',
    )
    expect(inspectVerdict({ onRegistry: false, inJournal: false })).toBe('not-on-registry')
  })

  test('registry subjects query exact parsed package versions and skip malformed subjects', async () => {
    const calls: string[] = []
    const result = await Effect.runPromise(
      registrySubjects(['@kitz/core@1.0.0', 'not-a-subject'], 'https://registry.npmjs.org/').pipe(
        Effect.provide(
          Layer.succeed(NpmRegistry.NpmCli, {
            whoami: () => Effect.die('unexpected whoami'),
            pack: () => Effect.die('unexpected pack'),
            publish: () => Effect.die('unexpected publish'),
            observeVersion: () => Effect.die('unexpected observe'),
            hasVersion: (packageName, version, options) => {
              calls.push(`${packageName}@${version}:${options?.registry ?? ''}`)
              return Effect.succeed(true)
            },
            listAccessPackages: () => Effect.die('unexpected listAccessPackages'),
            listAccessCollaborators: () => Effect.die('unexpected listAccessCollaborators'),
            getAccessStatus: () => Effect.die('unexpected getAccessStatus'),
          }),
        ),
      ),
    )

    expect(result).toEqual(['@kitz/core@1.0.0'])
    expect(calls).toEqual(['@kitz/core@1.0.0:https://registry.npmjs.org/'])
  })

  test('reconcile reads the plan-bound journal and registry state', async () => {
    const plan = Plan.make({
      lifecycle: 'official',
      timestamp: '2026-05-14T00:00:00.000Z',
      releases: [
        Official.make({
          package: {
            name: Pkg.Moniker.parse('@kitz/core'),
            scope: 'core',
            path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
          },
          version: OfficialFirst.make({
            version: Semver.fromString('1.0.0'),
            bump: 'major',
          }),
          commits: [],
        }),
      ],
      cascades: [],
      planDigest: digest,
    })
    const entry = makeEntry({
      planDigest: digest,
      kind: 'registry-publish',
      subject: '@kitz/core@1.0.0',
      planned: {},
      result: 'succeeded',
      attemptedAt: '2026-05-14T00:00:00.000Z',
    })
    const decision = await Effect.runPromise(
      Effect.gen(function* () {
        yield* writeEntries(journalPathFor(Fs.Path.AbsDir.fromString('/repo/'), digest), [entry])
        return yield* reconcile(plan)
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') }),
            Fs.Memory.layer({}),
            Layer.succeed(NpmRegistry.NpmCli, {
              whoami: () => Effect.die('unexpected whoami'),
              pack: () => Effect.die('unexpected pack'),
              publish: () => Effect.die('unexpected publish'),
              observeVersion: () => Effect.die('unexpected observe'),
              hasVersion: () => Effect.succeed(true),
              listAccessPackages: () => Effect.die('unexpected listAccessPackages'),
              listAccessCollaborators: () => Effect.die('unexpected listAccessCollaborators'),
              getAccessStatus: () => Effect.die('unexpected getAccessStatus'),
            }),
          ),
        ),
      ),
    )

    expect(decision.classification).toBe('clean')
  })
})
