/**
 * @module cli/commands/inspect
 *
 * Inspect a published or local release subject (`release inspect <package>@<version>`),
 * cross-referencing the registry, journal, and local artifact manifests.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Str } from '@kitz/core'
import { NpmRegistry } from '@kitz/npm-registry'
import {
  Array as A,
  Console,
  Effect,
  FileSystem,
  Layer,
  Option,
  Schema,
  SchemaGetter,
  SchemaIssue,
} from 'effect'
import { Argument, Command } from 'effect/unstable/cli'
import * as Artifact from '../../api/artifact.js'
import * as Journal from '../../api/journal.js'
import * as Reconciler from '../../api/reconciler.js'
import { ChildProcessSpawnerLayer } from '../../platform.js'
import { CommandBaseLayer, NpmCliLayer } from './_shared.js'

/** `<package>@<version>` — split on the LAST `@` so scoped names parse. */
const ReleaseSubject = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Struct({
      name: Schema.String,
      version: Schema.String,
    }),
    {
      decode: SchemaGetter.transformOrFail((subject: string) => {
        const versionSeparator = subject.lastIndexOf('@')
        if (versionSeparator <= 0 || versionSeparator === subject.length - 1) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(subject), {
              message: 'Expected a release subject of the form <package>@<version>',
            }),
          )
        }
        return Effect.succeed({
          name: subject.slice(0, versionSeparator),
          version: subject.slice(versionSeparator + 1),
        })
      }),
      encode: SchemaGetter.transform(
        ({ name, version }: { name: string; version: string }) => `${name}@${version}`,
      ),
    },
  ),
)

export const inspect = Command.make(
  'inspect',
  {
    target: Argument.string('target').pipe(
      Argument.withDescription('Release subject to inspect (<package>@<version>)'),
      Argument.withSchema(ReleaseSubject),
    ),
  },
  ({ target }) =>
    Effect.gen(function* () {
      const npm = yield* NpmRegistry.NpmCli
      const subject = `${target.name}@${target.version}`

      const matches = yield* Artifact.findManifests({
        packageName: target.name,
        version: target.version,
      })
      const journalMatches = yield* Journal.findPublishEntries(subject)
      const onRegistry = yield* npm.hasVersion(target.name, target.version)
      const legitimacy = Reconciler.inspectVerdict({
        onRegistry,
        inJournal: journalMatches.length > 0,
      })

      const b = Str.Builder()
      b`Inspection subject: ${subject}`
      b`Registry version: ${onRegistry ? 'present' : 'missing'}`
      b`Journal entries: ${journalMatches.map((entry) => entry.entryId).join(', ') || 'none'}`
      if (matches.length === 0) {
        b`Local artifact manifest: missing`
      } else {
        for (const match of matches) {
          b`Local artifact manifest: ${Fs.Path.toString(match.tarball)}`
          b`SHA-256: ${match.sha256.value}`
          b`Packlist entries: ${String(match.packlist.length)}`
        }
      }
      b`Legitimacy: ${legitimacy}`
      yield* Console.log(b.render())
    }),
).pipe(
  Command.withDescription('Inspect a published or local release subject'),
  Command.provide(Layer.mergeAll(CommandBaseLayer, ChildProcessSpawnerLayer, NpmCliLayer)),
)
