import { Env } from '@kitz/env'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Resource } from '@kitz/resource'
import { Effect, FileSystem, HashSet, Option, Schema } from 'effect'
import * as Journal from './journal.js'
import type { Plan } from './planner/models/plan.js'
import { digestForPlan } from './proof.js'
import { PlanDigest, ReconcileDecision, type SideEffectEntry } from './release-contract.js'

export interface ReconcileInput {
  readonly planDigest: PlanDigest
  readonly plannedSubjects: readonly string[]
  readonly journalSubjects: readonly string[]
  readonly registrySubjects: readonly string[]
  readonly journalValid?: boolean
}

export type InspectLegitimacyVerdict =
  | 'registry-matches-journal'
  | 'registry-disagrees-with-journal'
  | 'not-in-journal-but-on-registry'
  | 'not-on-registry'

const missing = (expected: readonly string[], actual: readonly string[]): readonly string[] => {
  const actualSet = HashSet.fromIterable(actual)
  return expected.filter((subject) => !HashSet.has(actualSet, subject))
}

export const classify = (input: ReconcileInput): ReconcileDecision => {
  if (input.journalValid === false) {
    return ReconcileDecision.make({
      classification: 'abort',
      planDigest: input.planDigest,
      evidenceIds: [`journal:${input.planDigest.value}:hash-chain-invalid`],
      stateDiff: ['execution journal hash chain is invalid'],
      nextCommand: 'none',
    })
  }

  const missingFromJournal = missing(input.plannedSubjects, input.journalSubjects)
  const missingFromRegistry = missing(input.plannedSubjects, input.registrySubjects)
  const journalWithoutRegistry = input.journalSubjects.filter((subject) =>
    missingFromRegistry.includes(subject),
  )
  const evidenceIds = [
    ...input.plannedSubjects.map((subject) => `plan:${subject}`),
    ...input.journalSubjects.map((subject) => `journal:${subject}`),
    ...input.registrySubjects.map((subject) => `registry:${subject}`),
  ]

  if (missingFromJournal.length === 0 && missingFromRegistry.length === 0) {
    return ReconcileDecision.make({
      classification: 'clean',
      planDigest: input.planDigest,
      evidenceIds,
      stateDiff: [],
      nextCommand: 'none',
    })
  }

  if (missingFromJournal.length > 0 && missingFromRegistry.length === 0) {
    return ReconcileDecision.make({
      classification: 'repair',
      planDigest: input.planDigest,
      evidenceIds,
      stateDiff: missingFromJournal.map(
        (subject) => `registry has ${subject}; journal is missing it`,
      ),
      nextCommand: 'release repair --action record-remote-success',
    })
  }

  if (journalWithoutRegistry.length > 0) {
    return ReconcileDecision.make({
      classification: 'abort',
      planDigest: input.planDigest,
      evidenceIds,
      stateDiff: journalWithoutRegistry.map(
        (subject) => `journal claims ${subject}; registry does not show it`,
      ),
      nextCommand: 'release repair --action manual-intervention',
    })
  }

  return ReconcileDecision.make({
    classification: 'resume',
    planDigest: input.planDigest,
    evidenceIds,
    stateDiff: missingFromRegistry.map((subject) => `registry is missing ${subject}`),
    nextCommand: 'release resume',
  })
}

export const subjectsForPlan = (plan: Plan): readonly string[] =>
  [...plan.releases, ...plan.cascades].map(
    (item) => `${item.package.name.moniker}@${item.nextVersion.toString()}`,
  )

export const journalSubjects = (entries: readonly SideEffectEntry[]): readonly string[] =>
  entries
    .filter(
      (entry) =>
        entry.kind === 'registry-publish' &&
        entry.result === 'succeeded' &&
        entry.subject.length > 0,
    )
    .map((entry) => entry.subject)

const decodeExactSubject = Schema.decodeUnknownOption(Pkg.Pin.Exact.FromString)

const splitSubject = (subject: string): { packageName: string; version: string } | undefined => {
  const decoded = decodeExactSubject(subject)
  if (Option.isNone(decoded)) return undefined

  return {
    packageName: decoded.value.name.moniker,
    version: decoded.value.version.toString(),
  }
}

export const registrySubjects = (
  subjects: readonly string[],
  registry?: string,
): Effect.Effect<readonly string[], NpmRegistry.NpmCliError, NpmRegistry.NpmCli> =>
  Effect.gen(function* () {
    const cli = yield* NpmRegistry.NpmCli
    const existing: string[] = []

    for (const subject of subjects) {
      const parsed = splitSubject(subject)
      if (parsed === undefined) continue
      const exists = yield* cli.hasVersion(parsed.packageName, parsed.version, {
        ...(registry !== undefined ? { registry } : {}),
      })
      if (exists) existing.push(subject)
    }

    return existing
  })

export const inspectVerdict = (params: {
  readonly onRegistry: boolean
  readonly inJournal: boolean
}): InspectLegitimacyVerdict => {
  if (params.onRegistry && params.inJournal) return 'registry-matches-journal'
  if (!params.onRegistry && params.inJournal) return 'registry-disagrees-with-journal'
  if (params.onRegistry) return 'not-in-journal-but-on-registry'
  return 'not-on-registry'
}

export const reconcile = (
  plan: Plan,
): Effect.Effect<
  ReconcileDecision,
  Resource.ResourceError | NpmRegistry.NpmCliError,
  Env.Env | FileSystem.FileSystem | NpmRegistry.NpmCli
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const planDigest = digestForPlan(plan)
    const plannedSubjects = subjectsForPlan(plan)
    const journalEntries = yield* Journal.readEntries(Journal.journalPathFor(env.cwd, planDigest))
    const registry = yield* registrySubjects(plannedSubjects, plan.publishIntent?.registry.url)

    return classify({
      planDigest,
      plannedSubjects,
      journalSubjects: journalSubjects(journalEntries),
      registrySubjects: registry,
      journalValid: Journal.verifyChain(journalEntries),
    })
  })
