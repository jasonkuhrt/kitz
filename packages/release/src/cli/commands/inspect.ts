import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, FileSystem, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, FileSystemLayer } from '../../platform.js'

const parseSubject = (subject: string): { name: string; version: string } | undefined => {
  const versionSeparator = subject.lastIndexOf('@')
  if (versionSeparator <= 0) return undefined
  return {
    name: subject.slice(0, versionSeparator),
    version: subject.slice(versionSeparator + 1),
  }
}

const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer))

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer, ChildProcessSpawnerLayer, npmLayer))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const fs = yield* FileSystem.FileSystem
    const npm = yield* NpmRegistry.NpmCli
    const argv = yield* Cli.parseArgv(env.argv)
    const subject = argv.args[1]
    if (subject === undefined) {
      yield* Console.error('Usage: release inspect <package>@<version>')
      return env.exit(1)
    }

    const parsed = parseSubject(subject)
    if (parsed === undefined) {
      yield* Console.error('Usage: release inspect <package>@<version>')
      return env.exit(1)
    }

    const artifactRoot = Fs.Path.join(env.cwd, Fs.Path.RelDir.fromString('./.release/artifacts/'))
    const artifactDirs = yield* fs
      .readDirectory(Fs.Path.toString(artifactRoot))
      .pipe(Effect.orElseSucceed(() => [] as string[]))
    const matches: Api.ReleaseContract.ArtifactManifest[] = []

    for (const dir of artifactDirs) {
      const manifestPath = Fs.Path.join(
        Fs.Path.join(artifactRoot, Fs.Path.RelDir.fromString(`./${dir}/`)),
        Fs.Path.RelFile.fromString('./manifest.json'),
      )
      const exists = yield* fs
        .exists(Fs.Path.toString(manifestPath))
        .pipe(Effect.orElseSucceed(() => false))
      if (!exists) continue
      const text = yield* fs.readFileString(Fs.Path.toString(manifestPath))
      const manifests = yield* Schema.decodeUnknownEffect(
        Schema.fromJsonString(Schema.Array(Api.ReleaseContract.ArtifactManifest)),
      )(text)
      matches.push(
        ...manifests.filter(
          (manifest) =>
            manifest.packageName.moniker === parsed.name &&
            manifest.version.toString() === parsed.version,
        ),
      )
    }

    const journalRoot = Fs.Path.join(env.cwd, Fs.Path.RelDir.fromString('./.release/journal/'))
    const journalFiles = yield* fs
      .readDirectory(Fs.Path.toString(journalRoot))
      .pipe(Effect.orElseSucceed(() => [] as string[]))
    const journalMatches: Api.ReleaseContract.SideEffectEntry[] = []

    for (const file of journalFiles.filter((name) => name.endsWith('.jsonl'))) {
      const path = Fs.Path.join(journalRoot, Fs.Path.RelFile.fromString(`./${file}`))
      const entries = yield* Api.Journal.readEntries(path)
      journalMatches.push(
        ...entries.filter(
          (entry) =>
            entry.kind === 'registry-publish' &&
            entry.result === 'succeeded' &&
            entry.subject === subject,
        ),
      )
    }

    const onRegistry = yield* npm.hasVersion(parsed.name, parsed.version)
    const legitimacy = Api.Reconciler.inspectVerdict({
      onRegistry,
      inJournal: journalMatches.length > 0,
    })

    yield* Console.log(`Inspection subject: ${subject}`)
    yield* Console.log(`Registry version: ${onRegistry ? 'present' : 'missing'}`)
    yield* Console.log(
      `Journal entries: ${journalMatches.map((entry) => entry.entryId).join(', ') || 'none'}`,
    )
    if (matches.length === 0) {
      yield* Console.log('Local artifact manifest: missing')
      yield* Console.log(`Legitimacy: ${legitimacy}`)
      return
    }

    for (const match of matches) {
      yield* Console.log(`Local artifact manifest: ${Fs.Path.toString(match.tarball)}`)
      yield* Console.log(`SHA-256: ${match.sha256.value}`)
      yield* Console.log(`Packlist entries: ${String(match.packlist.length)}`)
    }
    yield* Console.log(`Legitimacy: ${legitimacy}`)
  }),
)
