import { Fs } from '@kitz/fs'
import { Resource } from '@kitz/resource'
import { Effect, Option, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { jsonFile, jsonLinesFile } from './persistence.js'

const Entry = Schema.Struct({
  id: Schema.String,
  count: Schema.Number,
})

describe('release persistence helpers', () => {
  test('read and write typed JSON files with resource errors', async () => {
    const file = Fs.Path.AbsFile.fromString('/repo/.release/example.json')
    const json = jsonFile(Entry)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const missing = yield* json.read(file)
        yield* json.write({ id: 'first', count: 1 }, file)
        const written = yield* json.readRequired(file)
        yield* Fs.write(file, '{ nope')
        const malformed = yield* json.readRequired(file).pipe(Effect.flip)
        return { missing, written, malformed }
      }).pipe(Effect.provide(Fs.Memory.layer({}))),
    )

    expect(Option.isNone(result.missing)).toBe(true)
    expect(result.written).toEqual({ id: 'first', count: 1 })
    expect(result.malformed).toBeInstanceOf(Resource.ParseError)
  })

  test('read and write typed JSONL files', async () => {
    const file = Fs.Path.AbsFile.fromString('/repo/.release/journal/example.jsonl')
    const jsonl = jsonLinesFile(Entry)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const missing = yield* jsonl.read(file)
        yield* jsonl.write(
          [
            { id: 'first', count: 1 },
            { id: 'second', count: 2 },
          ],
          file,
        )
        const written = yield* jsonl.read(file)
        const raw = yield* Fs.readString(file)
        return { missing, written, raw }
      }).pipe(Effect.provide(Fs.Memory.layer({}))),
    )

    expect(result.missing).toEqual([])
    expect(result.written).toEqual([
      { id: 'first', count: 1 },
      { id: 'second', count: 2 },
    ])
    expect(result.raw.trim().split('\n')).toHaveLength(2)
  })
})
