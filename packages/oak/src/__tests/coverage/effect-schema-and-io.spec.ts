import { Effect, Exit, Option, Schema, SchemaGetter, Stream } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  EffectSchema as EffectSchemaMaybe,
  EffectSchemaInternals as EffectSchemaInternalsMaybe,
} from '../../extensions/effect-schema/effect-schema.js'
import {
  createKeyPressDependencies,
  readMany,
  readOneWith,
  type KeyPressEvent,
} from '../../lib/KeyPress/KeyPress.js'
import {
  createMemoryChannels,
  createMemoryPrompter,
  createMemoryState,
} from '../../lib/Prompter/Constructors/Memory.js'
import {
  createProcessChannels,
  createProcessPrompter,
} from '../../lib/Prompter/Constructors/Process.js'

const EffectSchema = EffectSchemaMaybe as Required<typeof EffectSchemaMaybe>
const EffectSchemaInternals = EffectSchemaInternalsMaybe as Required<
  typeof EffectSchemaInternalsMaybe
>
const decodeSync = (schema: Schema.Top) =>
  Schema.decodeSync(schema as Schema.Top & { readonly DecodingServices: never })

const keyEvent = (name: KeyPressEvent['name'], params?: Partial<KeyPressEvent>): KeyPressEvent => ({
  name,
  ctrl: false,
  meta: false,
  shift: false,
  sequence: name,
  ...params,
})

describe('oak coverage helpers: effect schema and io', () => {
  test('converts effect schemas to standard schema and extracts metadata', async () => {
    expect(EffectSchema.name).toBe('EffectSchema')

    const stringStandard = EffectSchema.toStandardSchema(Schema.String)
    expect(await stringStandard['~standard'].validate('oak')).toEqual({ value: 'oak' })
    expect(await stringStandard['~standard'].validate(1)).toMatchObject({
      issues: expect.any(Array),
    })

    const literalStandard = EffectSchema.toStandardSchema(Schema.Literal('json'))
    expect(await literalStandard['~standard'].validate('json')).toEqual({ value: 'json' })

    const optionFromUndefinedStandard = EffectSchema.toStandardSchema(
      Schema.OptionFromUndefinedOr(Schema.Number),
    )
    const optionFromUndefinedNone =
      await optionFromUndefinedStandard['~standard'].validate(undefined)
    const optionFromUndefinedSome = await optionFromUndefinedStandard['~standard'].validate(5)
    expect('value' in optionFromUndefinedNone && optionFromUndefinedNone.value._tag).toBe('None')
    expect('value' in optionFromUndefinedSome && optionFromUndefinedSome.value._tag).toBe('Some')

    const plainOptionStandard = EffectSchema.toStandardSchema(Schema.Option(Schema.Number))
    const plainOptionNone = await plainOptionStandard['~standard'].validate(undefined)
    const plainOptionSome = await plainOptionStandard['~standard'].validate(5)
    expect('value' in plainOptionNone && Option.isNone(plainOptionNone.value)).toBe(true)
    expect('value' in plainOptionSome && Option.isSome(plainOptionSome.value)).toBe(true)
    expect('value' in plainOptionSome && plainOptionSome.value.value).toBe(5)

    const rawOptionLiteral = EffectSchema.toStandardSchema(Schema.Option(Schema.Literal('yes')))
    const rawOptionStruct = EffectSchema.toStandardSchema(
      Schema.Option(Schema.Struct({ value: Schema.String })),
    )
    const rawOptionLiteralValue = await rawOptionLiteral['~standard'].validate('yes')
    const rawOptionStructValue = await rawOptionStruct['~standard'].validate({ value: 'ok' })
    expect('value' in rawOptionLiteralValue && Option.isSome(rawOptionLiteralValue.value)).toBe(
      true,
    )
    expect('value' in rawOptionLiteralValue && rawOptionLiteralValue.value.value).toBe('yes')
    expect('value' in rawOptionStructValue && Option.isSome(rawOptionStructValue.value)).toBe(true)
    expect('value' in rawOptionStructValue && rawOptionStructValue.value.value).toEqual({
      value: 'ok',
    })

    const defaultedBoolean = Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((value) => value ?? false),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(Schema.annotate({ default: false, description: 'Verbose mode' }))

    const defaultedBooleanStandard = EffectSchema.toStandardSchema(defaultedBoolean)
    expect(await defaultedBooleanStandard['~standard'].validate(undefined)).toEqual({
      value: false,
    })
    expect(await defaultedBooleanStandard['~standard'].validate(true)).toEqual({ value: true })

    const described = Schema.String.pipe(
      Schema.check(Schema.isMinLength(2)),
      Schema.annotate({ description: 'At least two characters' }),
    )

    expect(EffectSchema.extractMetadata(Schema.String)).toMatchObject({
      optionality: { _tag: 'required' },
      schema: { _tag: 'string' },
      helpHints: { displayType: 'string', priority: 1 },
    })
    expect(EffectSchema.extractMetadata(Schema.Number)).toMatchObject({
      schema: { _tag: 'number' },
      helpHints: { displayType: 'number', priority: 2 },
    })
    expect(EffectSchema.extractMetadata(Schema.Boolean)).toMatchObject({
      schema: { _tag: 'boolean' },
      helpHints: { displayType: 'boolean', priority: 3 },
    })
    expect(EffectSchema.extractMetadata(Schema.Literal('json'))).toMatchObject({
      schema: { _tag: 'literal', value: 'json' },
      helpHints: { displayType: "'json'", priority: 5 },
    })
    expect(EffectSchema.extractMetadata(Schema.Literals(['json', 'yaml']))).toMatchObject({
      schema: { _tag: 'enum', values: ['json', 'yaml'] },
      helpHints: { displayType: "'json' | 'yaml'", priority: 4 },
    })
    expect(EffectSchema.extractMetadata(Schema.UndefinedOr(Schema.String))).toMatchObject({
      optionality: { _tag: 'optional' },
      schema: { _tag: 'string' },
    })
    const optionFromUndefinedMetadata = EffectSchema.extractMetadata(
      Schema.OptionFromUndefinedOr(Schema.Number),
    )
    expect(optionFromUndefinedMetadata).toMatchObject({
      optionality: { _tag: 'default' },
      schema: { _tag: 'number' },
      helpHints: { displayType: 'number', priority: 2 },
    })
    expect(optionFromUndefinedMetadata.optionality._tag).toBe('default')
    if (optionFromUndefinedMetadata.optionality._tag === 'default') {
      expect(Option.isNone(optionFromUndefinedMetadata.optionality.getValue())).toBe(true)
    }

    const plainOptionMetadata = EffectSchema.extractMetadata(Schema.Option(Schema.Number))
    expect(plainOptionMetadata).toMatchObject({
      optionality: { _tag: 'default' },
      schema: { _tag: 'number' },
      helpHints: { displayType: 'number', priority: 2 },
    })
    expect(plainOptionMetadata.optionality._tag).toBe('default')
    if (plainOptionMetadata.optionality._tag === 'default') {
      expect(Option.isNone(plainOptionMetadata.optionality.getValue())).toBe(true)
    }

    const optionFromNullMetadata = EffectSchema.extractMetadata(
      Schema.OptionFromNullOr(Schema.Number),
    )
    expect(optionFromNullMetadata).toMatchObject({
      optionality: { _tag: 'default' },
      schema: { _tag: 'number' },
      helpHints: { displayType: 'number', priority: 2 },
    })
    expect(optionFromNullMetadata.optionality._tag).toBe('default')
    if (optionFromNullMetadata.optionality._tag === 'default') {
      expect(Option.isNone(optionFromNullMetadata.optionality.getValue())).toBe(true)
    }

    expect(EffectSchema.extractMetadata(Schema.NullOr(Schema.String))).toMatchObject({
      optionality: { _tag: 'optional', omittedValue: null },
      schema: { _tag: 'string' },
      helpHints: { displayType: 'string', priority: 1 },
    })
    expect(EffectSchema.extractMetadata(Schema.NullishOr(Schema.String))).toMatchObject({
      optionality: { _tag: 'optional' },
      schema: { _tag: 'string' },
      helpHints: { displayType: 'string', priority: 1 },
    })
    expect(
      EffectSchema.extractMetadata(Schema.Union([Schema.String, Schema.Number])),
    ).toMatchObject({
      schema: { _tag: 'union', members: [{ _tag: 'string' }, { _tag: 'number' }] },
      helpHints: { displayType: 'string | number', priority: 0 },
    })
    expect(
      EffectSchema.extractMetadata(
        Schema.Union([Schema.String, Schema.Struct({ value: Schema.String })]),
      ),
    ).toMatchObject({
      helpHints: { displayType: 'string | unknown', priority: 0 },
    })
    expect(
      EffectSchema.extractMetadata(Schema.NullishOr(Schema.Union([Schema.String, Schema.Number]))),
    ).toMatchObject({
      optionality: { _tag: 'optional' },
      helpHints: { displayType: 'string | number', priority: 0 },
    })
    expect(
      EffectSchema.extractMetadata(Schema.Union([Schema.Undefined, Schema.Null])),
    ).toMatchObject({
      optionality: { _tag: 'optional' },
      helpHints: { displayType: 'undefined | null', priority: 0 },
    })
    expect(
      EffectSchema.extractMetadata(Schema.Union([Schema.Literal('a'), Schema.Literal(3)])),
    ).toMatchObject({
      schema: { _tag: 'enum', values: ['a', 3] },
      helpHints: { displayType: "'a' | 3", priority: 4 },
    })
    const defaultedBooleanMetadata = EffectSchema.extractMetadata(defaultedBoolean)
    expect(defaultedBooleanMetadata).toMatchObject({
      description: 'Verbose mode',
      optionality: { _tag: 'default' },
      schema: { _tag: 'boolean' },
      helpHints: { displayType: 'boolean', priority: 3 },
    })
    expect(defaultedBooleanMetadata.optionality._tag).toBe('default')
    if (defaultedBooleanMetadata.optionality._tag === 'default') {
      expect(defaultedBooleanMetadata.optionality.getValue()).toBe(false)
    }
    expect(EffectSchema.extractMetadata(described)).toMatchObject({
      description: 'At least two characters',
      helpHints: {
        displayType: 'string',
        refinements: ['At least two characters'],
        priority: 1,
      },
    })
  })

  test('covers internal effect-schema ast helpers directly', () => {
    const stringAst = Schema.String.ast
    const numberAst = Schema.Number.ast
    const booleanAst = Schema.Boolean.ast
    const nullAst = Schema.Null.ast
    const undefinedAst = Schema.Undefined.ast
    const literalAst = Schema.Literal('json').ast
    const structAst = Schema.Struct({ value: Schema.String }).ast
    const optionAst = Schema.Option(Schema.Number).ast
    const optionFromUndefinedAst = Schema.OptionFromUndefinedOr(Schema.Number).ast
    const encodedDefaultBoolean = Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((value) => value ?? false),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(Schema.annotate({ default: false }))
    const enumUnionAst = Schema.Union([Schema.Literal('a'), Schema.Literal(3)]).ast as any
    const mixedUnionAst = Schema.Union([Schema.String, Schema.Number]).ast as any
    const undefinedUnionAst = Schema.Union([Schema.String, Schema.Undefined]).ast as any
    const nullUnionAst = Schema.Union([Schema.String, Schema.Null]).ast as any
    const literalNullUnionAst = Schema.Union([Schema.String, Schema.Null]).ast as any
    const nullishUnionAst = Schema.Union([
      Schema.String,
      Schema.Number,
      Schema.Undefined,
      Schema.Null,
    ]).ast as any
    const emptyNullishUnionAst = Schema.Union([Schema.Undefined, Schema.Null]).ast as any
    const described = Schema.String.pipe(
      Schema.check(Schema.isMinLength(2)),
      Schema.annotate({ description: 'At least two characters' }),
    )

    expect(EffectSchemaInternals.extractBaseTypeInfo(stringAst)).toMatchObject({
      schemaType: { _tag: 'string' },
      displayType: 'string',
      priority: 1,
    })
    expect(EffectSchemaInternals.extractBaseTypeInfo(numberAst)).toMatchObject({
      schemaType: { _tag: 'number' },
      displayType: 'number',
      priority: 2,
    })
    expect(EffectSchemaInternals.extractBaseTypeInfo(booleanAst)).toMatchObject({
      schemaType: { _tag: 'boolean' },
      displayType: 'boolean',
      priority: 3,
    })
    expect(EffectSchemaInternals.extractBaseTypeInfo(nullAst)).toMatchObject({
      schemaType: { _tag: 'literal', value: null },
      displayType: 'null',
      priority: 5,
    })
    expect(EffectSchemaInternals.extractBaseTypeInfo(undefinedAst)).toMatchObject({
      schemaType: { _tag: 'literal', value: undefined },
      displayType: 'undefined',
      priority: 5,
    })
    expect(EffectSchemaInternals.extractBaseTypeInfo(literalAst)).toMatchObject({
      schemaType: { _tag: 'literal', value: 'json' },
      displayType: "'json'",
      priority: 5,
    })
    expect(EffectSchemaInternals.extractBaseTypeInfo(structAst)).toBeNull()

    expect(EffectSchemaInternals.extractChecksInfo(described.ast)).toEqual([
      'At least two characters',
    ])
    expect(EffectSchemaInternals.extractChecksInfo(stringAst)).toEqual([])

    expect(EffectSchemaInternals.extractUnionInfo(enumUnionAst)).toMatchObject({
      schemaType: { _tag: 'enum', values: ['a', 3] },
      displayType: "'a' | 3",
      priority: 4,
    })
    expect(EffectSchemaInternals.extractUnionInfo(mixedUnionAst)).toMatchObject({
      schemaType: { _tag: 'union', members: [{ _tag: 'string' }, { _tag: 'number' }] },
      displayType: 'string | number',
      priority: 0,
    })

    expect(EffectSchemaInternals.extractSchemaTypeInfo(structAst)).toMatchObject({
      schemaType: { _tag: 'string' },
      displayType: 'unknown',
      priority: 0,
    })
    expect(EffectSchemaInternals.extractSchemaTypeInfo(described.ast)).toMatchObject({
      schemaType: { _tag: 'string' },
      refinements: ['At least two characters'],
      displayType: 'string',
      priority: 1,
    })
    expect(EffectSchemaInternals.extractSchemaTypeInfo(encodedDefaultBoolean.ast)).toMatchObject({
      schemaType: { _tag: 'boolean' },
      displayType: 'boolean',
      priority: 3,
    })

    expect(decodeSync(EffectSchemaInternals.buildSchemaFromAST(stringAst))('oak')).toBe('oak')
    expect(decodeSync(EffectSchemaInternals.buildSchemaFromAST(numberAst))(1)).toBe(1)
    expect(decodeSync(EffectSchemaInternals.buildSchemaFromAST(booleanAst))(true)).toBe(true)
    expect(decodeSync(EffectSchemaInternals.buildSchemaFromAST(nullAst))(null)).toBe(null)
    expect(decodeSync(EffectSchemaInternals.buildSchemaFromAST(undefinedAst))(undefined)).toBe(
      undefined,
    )
    expect(decodeSync(EffectSchemaInternals.buildSchemaFromAST(literalAst))('json')).toBe('json')
    expect(
      decodeSync(EffectSchemaInternals.buildSchemaFromAST(structAst))({ value: 'oak' }),
    ).toEqual({
      value: 'oak',
    })

    expect(EffectSchemaInternals.isOptionSchema(optionAst)).toBe(true)
    expect(EffectSchemaInternals.isOptionSchema(optionFromUndefinedAst)).toBe(true)
    expect(EffectSchemaInternals.isOptionSchema(Schema.String.ast)).toBe(false)
    expect(EffectSchemaInternals.getOptionInnerAst(optionAst)).toBe(numberAst)
    expect(EffectSchemaInternals.getOptionInnerAst(Schema.String.ast)).toBeNull()
    expect(EffectSchemaInternals.getEncodedUnion(optionAst)).toBeNull()
    expect(EffectSchemaInternals.getEncodedUnion(optionFromUndefinedAst)).toMatchObject({
      _tag: 'Union',
    })
    expect(EffectSchemaInternals.getAnnotatedDefault(encodedDefaultBoolean.ast)).toEqual({
      hasDefault: true,
      value: false,
    })
    expect(EffectSchemaInternals.getAnnotatedDefault(Schema.String.ast)).toEqual({
      hasDefault: false,
      value: undefined,
    })
    expect(EffectSchemaInternals.hasUndefinedMember(undefinedUnionAst)).toBe(true)
    expect(EffectSchemaInternals.hasUndefinedMember(mixedUnionAst)).toBe(false)
    expect(EffectSchemaInternals.hasNullMember(nullUnionAst)).toBe(true)
    expect(EffectSchemaInternals.hasNullMember(literalNullUnionAst)).toBe(true)
    expect(EffectSchemaInternals.hasNullMember(mixedUnionAst)).toBe(false)

    expect(EffectSchemaInternals.removeNullishFromUnion(emptyNullishUnionAst)).toBe(
      emptyNullishUnionAst,
    )
    expect(EffectSchemaInternals.removeNullishFromUnion(undefinedUnionAst)).toBe(stringAst)
    expect(EffectSchemaInternals.removeNullishFromUnion(nullishUnionAst)).toMatchObject({
      _tag: 'Union',
    })

    expect(
      EffectSchemaInternals.extractEffectSchemaMetadata(Schema.String, {
        description: 'Preset description',
        optionality: { _tag: 'optional', omittedValue: undefined },
      }),
    ).toMatchObject({
      description: 'Preset description',
      optionality: { _tag: 'optional', omittedValue: undefined },
      schemaType: { _tag: 'string' },
      helpHints: { displayType: 'string', priority: 1 },
    })
  })

  test('reads keypress effects through injectable dependencies', async () => {
    let listener: ((key: string, event: KeyPressEvent) => void) | undefined
    const rawModes: boolean[] = []
    let closed = 0
    const dependencies = {
      ...createKeyPressDependencies(),
      stdin: {
        isRaw: false,
        setRawMode: (mode: boolean) => {
          rawModes.push(mode)
          ;(dependencies.stdin as any).isRaw = mode
          return dependencies.stdin as any
        },
        on: (_event: string, next: (key: string, event: KeyPressEvent) => void) => {
          listener = next
          return dependencies.stdin as any
        },
        removeListener: () => dependencies.stdin as any,
      },
      stdout: { write: () => true } as any,
      createInterface: () =>
        ({
          close: () => {
            closed++
          },
        }) as any,
      emitKeypressEvents: () => undefined,
    }

    const pending = Effect.runPromise(readOneWith(dependencies))
    listener?.('', keyEvent('a', { sequence: 'a' }))

    expect(await pending).toEqual(keyEvent('a', { sequence: 'a' }))
    expect(rawModes).toEqual([true, false])
    expect(closed).toBe(1)

    const exitEvents = [keyEvent('a'), keyEvent('c', { ctrl: true }), keyEvent('b')]
    let exitIndex = 0
    const exitCollected = await Effect.runPromise(
      Stream.runCollect(
        readMany(
          undefined,
          Effect.sync(() => exitEvents[exitIndex++]!),
        ).pipe(Stream.take(2)),
      ),
    )
    expect(
      Array.from(exitCollected).map((event) => (Exit.isExit(event) ? 'exit' : event.name)),
    ).toEqual(['a', 'exit'])

    const continuedEvents = [keyEvent('c', { ctrl: true }), keyEvent('b')]
    let continueIndex = 0
    const continued = await Effect.runPromise(
      Stream.runCollect(
        readMany(
          { exitOnCtrlC: false },
          Effect.sync(() => continuedEvents[continueIndex++]!),
        ).pipe(Stream.take(2)),
      ),
    )
    expect(Array.from(continued)).toEqual(continuedEvents)
  })

  test('exposes memory prompter channels for deterministic testing', async () => {
    const state = createMemoryState()
    const channels = createMemoryChannels(state)
    const prompter = createMemoryPrompter()

    channels.output('hello')
    state.inputScript.push('answer')
    state.script.keyPress.push(keyEvent('tab'), keyEvent('return'))

    expect(await Effect.runPromise(channels.readLine())).toBe('answer')
    expect(state.history.output).toEqual(['hello'])
    expect(state.history.answers).toEqual(['answer'])
    expect(state.history.all).toEqual(['hello', 'answer'])

    const filtered = await Effect.runPromise(
      Stream.runCollect(channels.readKeyPresses({ matching: ['return'] })),
    )
    expect(Array.from(filtered)).toEqual([keyEvent('return')])
    expect(() => Effect.runSync(channels.readLine())).toThrow('No more values in read script.')

    prompter.say('done')
    prompter.answers.add(['next'])
    expect(prompter.history.output).toEqual(['done\n'])
    expect(prompter.answers.get()).toEqual(['next'])
  })

  test('creates process channels and prompters from injected io', async () => {
    const writes: string[] = []
    let lineListener: ((value: string) => void) | undefined
    let closed = 0
    const channels = createProcessChannels({
      stdout: { write: (value: string) => (writes.push(value), true) } as any,
      readMany: () => Stream.fromIterable([keyEvent('left'), Exit.void, keyEvent('right')]) as any,
      stdin: {} as any,
      createInterface: () =>
        ({
          once: (_event: string, next: (value: string) => void) => {
            lineListener = next
          },
          close: () => {
            closed++
          },
        }) as any,
    })

    channels.output('hello')
    expect(writes).toEqual(['hello'])

    const readKeys = await Effect.runPromise(
      Stream.runCollect(channels.readKeyPresses({ matching: ['right'] })),
    )
    expect(Array.from(readKeys).map((event) => (Exit.isExit(event) ? 'exit' : event.name))).toEqual(
      ['exit', 'right'],
    )

    const linePending = Effect.runPromise(channels.readLine())
    lineListener?.('typed')
    expect(await linePending).toBe('typed')
    expect(closed).toBe(1)

    const outputOnly: string[] = []
    const prompter = createProcessPrompter({
      output: (value) => {
        outputOnly.push(value)
      },
      readKeyPresses: () => Stream.empty as any,
      readLine: () => Effect.succeed('ignored'),
    })
    prompter.say('ok')
    expect(outputOnly).toEqual(['ok\n'])
  })
})
