import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Errors from '../../Errors/Errors.js'
import {
  parse as parseEnvironment,
  lookupEnvironmentVariableArgument,
} from '../../OpeningArgs/Environment/Environment.js'
import { parameterBasicCreate } from '../../Parameter/basic.js'
import {
  findByName,
  getNames,
  hasName,
  isOrHasType,
  validate as validateParameter,
} from '../../Parameter/helpers/CommandParameter.js'
import { createParameters } from '../../executor/helpers/createParameters.js'
import type { OakSchema } from '../../schema/oak-schema.js'
import * as SchemaRuntime from '../../schema/schema-runtime.js'
import { getDefaults } from '../../Settings/settings.js'

const promptDisabled = { enabled: false, when: null } as const

const makeSchema = <Output>(params: {
  schema: OakSchema['metadata']['schema']
  validate: (value: unknown) => unknown
  description?: string
  optionality?: OakSchema<unknown, Output>['metadata']['optionality']
  helpHints?: OakSchema<unknown, Output>['metadata']['helpHints']
}): OakSchema<unknown, Output> => ({
  standardSchema: {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: params.validate as any,
    },
  },
  metadata: {
    ...(params.description === undefined ? {} : { description: params.description }),
    optionality: params.optionality ?? { _tag: 'required' },
    schema: params.schema,
    ...(params.helpHints === undefined ? {} : { helpHints: params.helpHints }),
  } as any,
})

const booleanSchema = makeSchema<boolean>({
  schema: { _tag: 'boolean' },
  validate: (value) =>
    typeof value === 'boolean' ? { value } : { issues: [{ message: 'Expected boolean value' }] },
  helpHints: { displayType: 'boolean', priority: 3 },
})

const stringSchema = makeSchema<string>({
  schema: { _tag: 'string' },
  validate: (value) =>
    typeof value === 'string' ? { value } : { issues: [{ message: 'Expected string value' }] },
  helpHints: { displayType: 'string', priority: 1 },
})

const numberSchema = makeSchema<number>({
  schema: { _tag: 'number' },
  validate: (value) =>
    typeof value === 'number' ? { value } : { issues: [{ message: 'Expected number value' }] },
  helpHints: { displayType: 'number', priority: 2 },
})

const optionalNullSchema = makeSchema<null>({
  schema: { _tag: 'string' },
  validate: (value) => ({ value: value as null }),
  optionality: { _tag: 'optional', omittedValue: null },
  helpHints: { displayType: 'string', priority: 1 },
})

const nestedUnionSchema = makeSchema<boolean | number>({
  schema: {
    _tag: 'union',
    members: [{ _tag: 'number' }, { _tag: 'union', members: [{ _tag: 'boolean' }] }],
  },
  validate: (value) =>
    typeof value === 'boolean' || typeof value === 'number'
      ? { value }
      : { issues: [{ message: 'Expected boolean or number' }] },
  helpHints: { displayType: 'boolean | number', priority: 0 },
})

const promiseSchema = makeSchema<string>({
  schema: { _tag: 'string' },
  validate: (value) => Promise.resolve({ value: String(value) }),
  helpHints: { displayType: 'string', priority: 1 },
})

const unknownResultSchema = makeSchema<string>({
  schema: { _tag: 'string' },
  validate: () => ({ unexpected: true }),
  helpHints: { displayType: 'string', priority: 1 },
})

const enumNumberSchema = makeSchema<number>({
  schema: { _tag: 'enum', values: [1, 2, 3] },
  validate: (value) =>
    typeof value === 'number' && [1, 2, 3].includes(value)
      ? { value }
      : { issues: [{ message: 'Expected enum member' }] },
  helpHints: { displayType: '1 | 2 | 3', priority: 4 },
})

const literalSchema = makeSchema<'json'>({
  schema: { _tag: 'literal', value: 'json' },
  validate: (value) => (value === 'json' ? { value } : { issues: [{ message: 'Expected json' }] }),
  helpHints: { displayType: "'json'", priority: 5 },
})

const objectUnionSchema = makeSchema<{ a: number }>({
  schema: { _tag: 'union', members: [{ _tag: 'string' }, { _tag: 'number' }] },
  validate: (value) =>
    typeof value === 'object' && value !== null && 'a' in value
      ? { value: value as { a: number } }
      : { issues: [{ message: 'Expected object payload' }] },
  helpHints: {
    displayType: 'string | number',
    displayTypeExpanded: 'string | number',
    refinements: ['object payload'],
    priority: 0,
  },
  description: 'Reads object-like values',
})

describe('oak coverage helpers: errors, parameters, and schema runtime', () => {
  test('renders oak error messages from contextual constructors', () => {
    const parameter = { name: { canonical: 'verbose' } } as any
    const group = {
      parameters: {
        verbose: parameter,
        quiet: { name: { canonical: 'quiet' } },
      },
    } as any

    expect(
      new Errors.Global.ErrorUnknownParameterViaEnvironment({
        context: { flagName: 'CLI_PARAM_VERBOSE', prefix: 'cli_param' },
      }).message,
    ).toContain('Unknown parameter via environment')

    expect(
      new Errors.Global.ErrorUnknownFlag({ context: { flagName: '--mystery' } }).message,
    ).toContain('Unknown flag "--mystery"')

    expect(
      new Errors.ErrorDuplicateLineArg({
        context: { parameter, flagName: '--verbose' },
      }).message,
    ).toContain('multiple times via flags')

    expect(
      new Errors.ErrorDuplicateEnvArg({
        context: {
          parameter,
          instances: [{ name: 'verbose', prefix: 'cli_param', value: 'true' }],
        },
      }).message,
    ).toContain('different parameter aliases in the environment')

    expect(
      new Errors.ErrorFailedToGetDefaultArgument({ context: { spec: parameter } }).message,
    ).toContain('Failed to get default value for verbose')

    expect(new Errors.ErrorMissingArgument({ context: { parameter } }).message).toContain(
      'Missing argument for flag "verbose"',
    )

    expect(
      new Errors.ErrorMissingArgumentForMutuallyExclusiveParameters({
        context: { group },
      }).message,
    ).toContain('verbose, quiet')

    expect(
      new Errors.ErrorArgumentsToMutuallyExclusiveParameters({
        context: {
          group,
          offenses: [
            { spec: parameter, arg: { source: 'flag', value: 'true' as any } as any },
            { spec: group.parameters.quiet, arg: { source: 'flag', value: 'false' as any } as any },
          ],
        },
      }).message,
    ).toContain('verbose, quiet')

    expect(
      new Errors.ErrorInvalidArgument({
        context: {
          spec: parameter,
          value: 'bad',
          validationErrors: ['Expected boolean value'],
          environmentVariableName: 'CLI_PARAM_VERBOSE',
        },
      }).message,
    ).toContain('via environment variable "CLI_PARAM_VERBOSE"')

    expect(
      new Errors.ErrorInvalidArgument({
        context: {
          spec: parameter,
          value: 'bad',
          validationErrors: ['Expected boolean value'],
        },
      }).message,
    ).toContain('Invalid argument for parameter: "verbose"')
  })

  test('handles parameter name lookup, type checks, and defaults', () => {
    const settings = getDefaults({})
    const booleanParameter = parameterBasicCreate(
      {
        _tag: 'Basic',
        nameExpression: '-v --verbose --verb',
        type: booleanSchema,
        prompt: promptDisabled,
      },
      settings,
    )
    const optionalParameter = parameterBasicCreate(
      {
        _tag: 'Basic',
        nameExpression: '--nickname',
        type: optionalNullSchema,
        prompt: promptDisabled,
      },
      settings,
    )
    const unionParameter = parameterBasicCreate(
      {
        _tag: 'Basic',
        nameExpression: '--level',
        type: nestedUnionSchema,
        prompt: promptDisabled,
      },
      settings,
    )

    expect(getNames(booleanParameter)).toEqual(expect.arrayContaining(['verbose', 'verb', 'v']))
    expect(findByName('verb', [booleanParameter])).toBe(booleanParameter)
    expect(hasName(booleanParameter, 'verbose')).toEqual({ kind: 'long', negated: false })
    expect(hasName(booleanParameter, 'verb')).toEqual({ kind: 'longAlias', negated: false })
    expect(hasName(booleanParameter, 'v')).toEqual({ kind: 'short' })
    expect(hasName(booleanParameter, 'noVerbose')).toEqual({ kind: 'long', negated: true })
    expect(hasName(booleanParameter, 'missing')).toBeNull()

    expect(isOrHasType(booleanParameter, 'TypeBoolean')).toBe(true)
    expect(isOrHasType(unionParameter, 'TypeBoolean')).toBe(true)
    expect(isOrHasType(unionParameter, 'TypeNumber')).toBe(true)
    expect(isOrHasType(booleanParameter, 'TypeString')).toBe(false)

    const omitted = validateParameter(optionalParameter, undefined)
    expect(Result.isSuccess(omitted)).toBe(true)
    if (Result.isSuccess(omitted)) {
      expect(omitted.success).toBeNull()
    }

    const validated = validateParameter(booleanParameter, true)
    expect(Result.isSuccess(validated)).toBe(true)
    const rejected = validateParameter(booleanParameter, 'true')
    expect(Result.isFailure(rejected)).toBe(true)
  })

  test('creates parameters and injects the built-in help flag when enabled', () => {
    const withHelp = getDefaults({})
    const withoutHelp = getDefaults({})
    withoutHelp.help = false

    const inputs = {
      '--name': {
        _tag: 'Basic' as const,
        nameExpression: '--name',
        type: stringSchema,
        prompt: promptDisabled,
      },
    }

    const parametersWithHelp = createParameters(inputs, withHelp)
    expect(parametersWithHelp.map((parameter) => parameter.name.canonical)).toEqual([
      'name',
      'help',
    ])

    const help = parametersWithHelp[1]
    expect(help?.type.metadata.optionality._tag).toBe('default')
    expect(help?.type.standardSchema['~standard'].validate('1')).toEqual({ value: true })
    expect(help?.type.standardSchema['~standard'].validate('0')).toEqual({ value: false })
    expect(help?.type.standardSchema['~standard'].validate('wat')).toEqual({
      issues: [{ message: 'Expected boolean value' }],
    })

    const parametersWithoutHelp = createParameters(inputs, withoutHelp)
    expect(parametersWithoutHelp.map((parameter) => parameter.name.canonical)).toEqual(['name'])
  })

  test('parses environment arguments and detects duplicate aliases', () => {
    const settings = getDefaults({})
    const parameter = parameterBasicCreate(
      {
        _tag: 'Basic',
        nameExpression: '--verbose --verb',
        type: booleanSchema,
        prompt: promptDisabled,
      },
      settings,
    )

    const parsed = parseEnvironment(
      {
        CLI_PARAM_VERBOSE: 'true',
        CLI_PARAMETER_VERB: 'false',
        CLI_PARAM_VERB: 'true',
      },
      [parameter],
    )

    const report = parsed.reports['verbose']
    expect(parsed.globalErrors).toEqual([])
    expect(report?.source.name).toBe('CLI_PARAM_VERBOSE')
    expect(report?.value).toEqual({ _tag: 'boolean', value: true, negated: false })

    const duplicate = report?.errors.find((error) => error._tag === 'OakErrorDuplicateEnvArg')
    expect(duplicate).toBeDefined()
    if (duplicate && duplicate._tag === 'OakErrorDuplicateEnvArg') {
      expect(duplicate.context.instances).toEqual([
        { name: 'verb', prefix: 'cliParameter', value: 'false' },
        { name: 'verb', prefix: 'cliParam', value: 'true' },
      ])
    }
  })

  test('looks up environment variables with prefixes, negation, and duplicate detection', () => {
    expect(
      lookupEnvironmentVariableArgument(
        ['CLI_PARAM'],
        { cli_param_release_channel: 'candidate' },
        'releaseChannel',
      ),
    ).toEqual({
      name: 'cli_param_release_channel',
      value: 'candidate',
    })

    expect(
      lookupEnvironmentVariableArgument([], { release_channel: 'official' }, 'releaseChannel'),
    ).toEqual({
      name: 'release_channel',
      value: 'official',
    })

    expect(() =>
      lookupEnvironmentVariableArgument(
        ['CLI_PARAM', 'CLI_PARAMETER'],
        {
          cli_param_release_channel: 'candidate',
          cli_parameter_release_channel: 'official',
        },
        'releaseChannel',
      ),
    ).toThrow('Multiple environment variables found for same parameter "releaseChannel"')

    const settings = getDefaults({})
    const parameter = parameterBasicCreate(
      {
        _tag: 'Basic',
        nameExpression: '--verbose',
        type: booleanSchema,
        prompt: promptDisabled,
      },
      settings,
    )
    const parsed = parseEnvironment({ CLI_PARAM_NO_VERBOSE: 'true' }, [parameter])
    expect(parsed.reports['verbose']?.value).toEqual({
      _tag: 'boolean',
      value: true,
      negated: true,
    })
  })

  test('validates, deserializes, and renders oak schema runtime helpers', () => {
    const validated = SchemaRuntime.validate(stringSchema, 'value')
    expect(Result.isSuccess(validated)).toBe(true)

    const failed = SchemaRuntime.validate(numberSchema, 'oops')
    expect(Result.isFailure(failed)).toBe(true)
    if (Result.isFailure(failed)) {
      expect(failed.failure.errors).toEqual(['Expected number value'])
    }

    const asyncFailure = SchemaRuntime.validate(promiseSchema, 'value')
    expect(Result.isFailure(asyncFailure)).toBe(true)
    if (Result.isFailure(asyncFailure)) {
      expect(asyncFailure.failure.errors).toEqual(['Oak only supports synchronous schemas'])
    }

    const unknownFailure = SchemaRuntime.validate(unknownResultSchema, 'value')
    expect(Result.isFailure(unknownFailure)).toBe(true)
    if (Result.isFailure(unknownFailure)) {
      expect(unknownFailure.failure.errors).toEqual(['Unknown validation error'])
    }

    const deserializedString = SchemaRuntime.deserialize(stringSchema, 'hello')
    expect(Result.isSuccess(deserializedString)).toBe(true)
    if (Result.isSuccess(deserializedString)) {
      expect(deserializedString.success).toBe('hello')
    }

    const deserializedBoolean = SchemaRuntime.deserialize(booleanSchema, 'yes')
    expect(Result.isSuccess(deserializedBoolean)).toBe(true)
    if (Result.isSuccess(deserializedBoolean)) {
      expect(deserializedBoolean.success).toBe(true)
    }

    const deserializedNumber = SchemaRuntime.deserialize(numberSchema, '42')
    expect(Result.isSuccess(deserializedNumber)).toBe(true)
    if (Result.isSuccess(deserializedNumber)) {
      expect(deserializedNumber.success).toBe(42)
    }

    const deserializedEnum = SchemaRuntime.deserialize(enumNumberSchema, '2')
    expect(Result.isSuccess(deserializedEnum)).toBe(true)
    if (Result.isSuccess(deserializedEnum)) {
      expect(deserializedEnum.success).toBe(2)
    }

    const deserializedLiteral = SchemaRuntime.deserialize(literalSchema, 'json')
    expect(Result.isSuccess(deserializedLiteral)).toBe(true)

    const deserializedObject = SchemaRuntime.deserialize(objectUnionSchema, '{"a":1}')
    expect(Result.isSuccess(deserializedObject)).toBe(true)
    if (Result.isSuccess(deserializedObject)) {
      expect(deserializedObject.success).toEqual({ a: 1 })
    }

    const badBoolean = SchemaRuntime.deserialize(booleanSchema, 'maybe')
    expect(Result.isFailure(badBoolean)).toBe(true)
    if (Result.isFailure(badBoolean)) {
      expect(badBoolean.failure.message).toContain('Deserialization failed')
    }

    const asyncDeserialize = SchemaRuntime.deserialize(promiseSchema, 'hello')
    expect(Result.isFailure(asyncDeserialize)).toBe(true)
    if (Result.isFailure(asyncDeserialize)) {
      expect(asyncDeserialize.failure.message).toBe('Oak only supports synchronous schemas')
    }

    expect(SchemaRuntime.display(objectUnionSchema)).toBe('string | number')
    expect(SchemaRuntime.displayExpanded(objectUnionSchema)).toBe('string | number')
    expect(SchemaRuntime.getTag(booleanSchema)).toBe('TypeBoolean')
    expect(SchemaRuntime.getTag(numberSchema)).toBe('TypeNumber')
    expect(SchemaRuntime.getTag(stringSchema)).toBe('TypeString')
    expect(SchemaRuntime.getTag(objectUnionSchema)).toBe('TypeUnion')
    expect(SchemaRuntime.getTag(enumNumberSchema)).toBe('TypeScalar')
    expect(
      SchemaRuntime.getTag({
        ...stringSchema,
        metadata: { ...stringSchema.metadata, schema: { _tag: 'mystery' } as any },
      }),
    ).toBe('TypeScalar')
    expect(SchemaRuntime.help(objectUnionSchema)).toContain('Reads object-like values')
    expect(SchemaRuntime.help(objectUnionSchema)).toContain('object payload')
  })
})
