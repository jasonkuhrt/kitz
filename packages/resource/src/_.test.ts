import { Effect, Option, Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Fs } from '@kitz/fs'
import { Platform } from '@kitz/platform'
import * as ResourceModule from './_.js'
import { createJsonc } from './jsonc.js'
import {
  create,
  createJson,
  createJsonLines,
  EncodeError,
  isEncodeError,
  isParseError,
  isReadError,
  isResourceError,
  isWriteError,
  NotFoundError,
  ParseError,
  ReadError,
  WriteError,
} from './resource.js'
import { NotFoundError as ResourceNotFoundError } from './errors.js'

describe('resource', () => {
  test('exports the Resource namespace', () => {
    expect(ResourceModule.Resource.create).toBe(create)
    expect(ResourceModule.Resource.createJson).toBe(createJson)
    expect(ResourceModule.Resource.createJsonLines).toBe(createJsonLines)
    expect(ResourceModule.Resource.createJsonc).toBe(createJsonc)
    expect(ResourceModule.Resource.Errors.ReadError).toBe(ReadError)
  })

  test('reads, writes, updates, and deletes string resources', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-' })
        const notes = create('notes.txt', Schema.String, '')

        expect(yield* notes.read(tempDir)).toEqual(Option.none())
        yield* notes.write('hello', tempDir)
        const firstRead = yield* notes.readRequired(tempDir)
        const updated = yield* notes.update(tempDir, (current) => `${current} world`)
        const deleted = yield* notes.delete(tempDir)
        const deletedAgain = yield* notes.delete(tempDir)

        return { firstRead, updated, deleted, deletedAgain }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result).toEqual({
      firstRead: 'hello',
      updated: 'hello world',
      deleted: true,
      deletedAgain: false,
    })
  })

  test('fails required reads for missing string resources', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-missing-' })
        const notes = create('notes.txt', Schema.String, '')

        return yield* notes.readRequired(tempDir).pipe(Effect.flip)
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(error).toBeInstanceOf(NotFoundError)
  })

  test('supports JSON resources at directory and absolute file paths', async () => {
    const Config = Schema.Struct({
      name: Schema.String,
      count: Schema.Number,
    })

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-json-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./config.json'))
        const config = createJson(
          'config.json',
          Config,
          {
            name: 'default',
            count: 0,
          },
          { preserveExcessProperties: true },
        )

        expect(yield* config.readOrEmpty(tempDir)).toEqual({ name: 'default', count: 0 })

        yield* config.write(
          {
            name: 'demo',
            count: 2,
          },
          filePath,
        )

        const raw = yield* Fs.readString(filePath)
        const decoded = yield* config.readRequired(filePath)

        return { raw, decoded }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result.decoded).toEqual({ name: 'demo', count: 2 })
    expect(result.raw).toBe('{"name":"demo","count":2}')
  })

  test('maps write failures to WriteError', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-write-' })
        const blocker = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./blocker'))
        yield* Fs.write(blocker, 'not a directory')

        const notes = create('notes.txt', Schema.String, '')
        const invalidDirectory = Fs.Path.AbsDir.fromString(Fs.Path.toString(blocker))

        return yield* notes.write('hello', invalidDirectory).pipe(Effect.flip)
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(error).toBeInstanceOf(WriteError)
  })

  test('supports JSONC resources and resource error guards', async () => {
    const Config = Schema.Struct({
      name: Schema.String,
    })

    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonc-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./config.jsonc'))
        const jsonc = createJsonc('config.jsonc', Config, { name: 'fallback' })

        expect(yield* jsonc.readOrEmpty(tempDir)).toEqual({ name: 'fallback' })

        yield* Fs.write(
          filePath,
          `{
            // comment
            "name": "demo",
          }`,
        )
        const decoded = yield* jsonc.readRequired(tempDir)

        yield* Fs.write(filePath, '{ invalid jsonc')
        const parseError = yield* jsonc.readRequired(tempDir).pipe(Effect.flip)

        const missingRequired = yield* jsonc
          .readRequired(Fs.Path.AbsDir.fromString('/tmp/kitz-resource-missing'))
          .pipe(Effect.flip)

        return { decoded, parseError, missingRequired }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    const path = Fs.Path.AbsFile.fromString('/tmp/resource.json')
    const readError = new ReadError({ context: { path, detail: 'read failed' } })
    const writeError = new WriteError({ context: { path, detail: 'write failed' } })
    const parseError = new ParseError({ context: { path, detail: 'parse failed' } })
    const encodeError = new EncodeError({ context: { path, detail: 'encode failed' } })
    const notFoundError = new ResourceNotFoundError({ context: { path } })

    expect(outcome.decoded).toEqual({ name: 'demo' })
    expect(outcome.parseError).toBeInstanceOf(ParseError)
    expect(outcome.missingRequired).toBeInstanceOf(NotFoundError)
    expect(readError.message).toContain('Failed to read /tmp/resource.json: read failed')
    expect(writeError.message).toContain('Failed to write /tmp/resource.json: write failed')
    expect(parseError.message).toContain('Failed to parse /tmp/resource.json: parse failed')
    expect(encodeError.message).toContain('Failed to encode /tmp/resource.json: encode failed')
    expect(notFoundError.message).toContain('Resource not found: /tmp/resource.json')
    expect(isReadError(readError)).toBe(true)
    expect(isWriteError(writeError)).toBe(true)
    expect(isParseError(parseError)).toBe(true)
    expect(isEncodeError(encodeError)).toBe(true)
    expect(isResourceError(readError)).toBe(true)
    expect(isResourceError(writeError)).toBe(true)
    expect(isResourceError(parseError)).toBe(true)
    expect(isResourceError(encodeError)).toBe(true)
    expect(isResourceError(outcome.missingRequired)).toBe(false)
  })
})

describe('json lines', () => {
  const Entry = Schema.Struct({
    id: Schema.String,
    value: Schema.Number,
  })

  test('writes one JSON line per item and reads them back', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        const missing = yield* entries.read(tempDir)
        const missingOrEmpty = yield* entries.readOrEmpty(tempDir)

        yield* entries.write(
          [
            { id: 'a', value: 1 },
            { id: 'b', value: 2 },
          ],
          tempDir,
        )

        const raw = yield* Fs.readString(filePath)
        const decoded = yield* entries.readRequired(filePath)

        return { missing, missingOrEmpty, raw, decoded }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result.missing).toEqual(Option.none())
    expect(result.missingOrEmpty).toEqual([])
    expect(result.raw).toBe('{"id":"a","value":1}\n{"id":"b","value":2}\n')
    expect(result.decoded).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ])
  })

  test('fails required reads for missing json lines resources', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const entries = createJsonLines('entries.jsonl', Entry)

        return yield* entries.readRequired(tempDir).pipe(Effect.flip)
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(error).toBeInstanceOf(NotFoundError)
  })

  test('append creates a missing file and extends an existing one', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        yield* entries.append({ id: 'a', value: 1 }, tempDir)
        const afterFirst = yield* Fs.readString(filePath)

        yield* entries.append({ id: 'b', value: 2 }, tempDir)
        yield* entries.append({ id: 'c', value: 3 }, filePath)
        const afterAll = yield* Fs.readString(filePath)
        const decoded = yield* entries.readRequired(tempDir)

        return { afterFirst, afterAll, decoded }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result.afterFirst).toBe('{"id":"a","value":1}\n')
    expect(result.afterAll).toBe(
      '{"id":"a","value":1}\n{"id":"b","value":2}\n{"id":"c","value":3}\n',
    )
    expect(result.decoded).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ])
  })

  test('append preserves entries written by write without blank lines', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        yield* entries.write(
          [
            { id: 'a', value: 1 },
            { id: 'b', value: 2 },
          ],
          tempDir,
        )
        yield* entries.append({ id: 'c', value: 3 }, tempDir)

        const raw = yield* Fs.readString(filePath)
        const decoded = yield* entries.readRequired(tempDir)

        return { raw, decoded }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result.raw).toBe('{"id":"a","value":1}\n{"id":"b","value":2}\n{"id":"c","value":3}\n')
    expect(result.raw).not.toContain('\n\n')
    expect(result.decoded).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ])
  })

  test('append repairs framing when the file lacks a trailing newline', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        // Foreign file without trailing newline
        yield* Fs.write(filePath, '{"id":"a","value":1}')
        yield* entries.append({ id: 'b', value: 2 }, tempDir)

        const raw = yield* Fs.readString(filePath)
        const decoded = yield* entries.readRequired(tempDir)

        return { raw, decoded }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result.raw).toBe('{"id":"a","value":1}\n{"id":"b","value":2}\n')
    expect(result.decoded).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ])
  })

  test('append to an existing empty file adds no blank line', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        yield* Fs.write(filePath, '')
        yield* entries.append({ id: 'a', value: 1 }, tempDir)

        return yield* Fs.readString(filePath)
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result).toBe('{"id":"a","value":1}\n')
  })

  test('writing an empty array round-trips through an empty file', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        yield* entries.write([], tempDir)

        const raw = yield* Fs.readString(filePath)
        const decoded = yield* entries.readRequired(tempDir)

        return { raw, decoded }
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(result.raw).toBe('')
    expect(result.decoded).toEqual([])
  })

  test('surfaces ParseError for invalid JSON lines', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        yield* Fs.write(filePath, '{"id":"a","value":1}\nnot json\n')

        return yield* entries.readRequired(tempDir).pipe(Effect.flip)
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(error).toBeInstanceOf(ParseError)
  })

  test('surfaces ParseError when a line fails item schema decoding', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const tempDir = yield* Fs.makeTempDirectoryScoped({ prefix: 'kitz-resource-jsonl-' })
        const filePath = Fs.Path.join(tempDir, Fs.Path.RelFile.fromString('./entries.jsonl'))
        const entries = createJsonLines('entries.jsonl', Entry)

        yield* Fs.write(filePath, '{"id":"a","value":"not a number"}\n')

        return yield* entries.readRequired(tempDir).pipe(Effect.flip)
      }).pipe(Effect.scoped, Effect.provide(Platform.FileSystem.layer)),
    )

    expect(error).toBeInstanceOf(ParseError)
  })
})
