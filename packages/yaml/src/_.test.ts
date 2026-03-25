import { Effect, Schema } from 'effect'
import { Fs } from '@kitz/fs'
import { Platform } from '@kitz/platform'
import { describe, expect, test } from 'vitest'
import { Yaml } from './_.js'

describe('Yaml', () => {
  test('parseYaml decodes a typed YAML document', () => {
    const Config = Schema.Struct({
      name: Schema.String,
      enabled: Schema.Boolean,
    })

    const ConfigFromYaml = Yaml.parseYaml().pipe(Schema.decodeTo(Config))

    const config = Schema.decodeUnknownSync(ConfigFromYaml)(`
name: demo
enabled: true
`)

    expect(config).toEqual({
      name: 'demo',
      enabled: true,
    })
  })

  test('parseYaml encodes structured values back to YAML', () => {
    const Config = Schema.Struct({
      name: Schema.String,
      count: Schema.Number,
    })

    const ConfigFromYaml = Yaml.parseYaml().pipe(Schema.decodeTo(Config))
    const encoded = Schema.encodeSync(ConfigFromYaml)({
      name: 'demo',
      count: 2,
    })

    expect(encoded).toContain('name: demo')
    expect(encoded).toContain('count: 2')
  })

  test('parseYaml reports invalid YAML decode failures', () => {
    const Config = Schema.Struct({
      name: Schema.String,
    })

    const ConfigFromYaml = Yaml.parseYaml().pipe(Schema.decodeTo(Config))

    expect(() =>
      Schema.decodeUnknownSync(ConfigFromYaml)(`
name:
  - invalid
  - [
`),
    ).toThrow()
  })

  test('parseYaml wraps non-Error YAML encoding failures with a fallback message', () => {
    expect(() =>
      Schema.encodeSync(Yaml.parseYaml())({
        toJSON() {
          throw 'boom'
        },
      }),
    ).toThrow('Invalid YAML value')
  })

  test('parseYaml preserves Error messages from YAML encoding failures', () => {
    expect(() =>
      Schema.encodeSync(Yaml.parseYaml())({
        toJSON() {
          throw new Error('yaml encode exploded')
        },
      }),
    ).toThrow('yaml encode exploded')
  })

  test('createResource reads and writes YAML files', async () => {
    const Config = Schema.Struct({
      name: Schema.String,
      count: Schema.Number,
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-yaml-' })
        const resource = Yaml.createResource('config.yaml', Config, {
          name: 'default',
          count: 0,
        })

        yield* resource.write(
          {
            name: 'demo',
            count: 4,
          },
          tempDir,
        )

        const raw = yield* Fs.readString(
          Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./config.yaml')),
        )
        const value = yield* resource.readRequired(tempDir)

        return { raw, value }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result.raw).toContain('name: demo')
    expect(result.raw).toContain('count: 4')
    expect(result.value).toEqual({
      name: 'demo',
      count: 4,
    })
  })

  test('createResource falls back to the provided empty value for missing files', async () => {
    const Config = Schema.Struct({
      name: Schema.String,
      count: Schema.Number,
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-yaml-' })
        const resource = Yaml.createResource('config.yaml', Config, {
          name: 'default',
          count: 0,
        })

        return yield* resource.readOrEmpty(tempDir)
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result).toEqual({
      name: 'default',
      count: 0,
    })
  })
})
