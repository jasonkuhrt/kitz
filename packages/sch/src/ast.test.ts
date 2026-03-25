import { Schema as S } from 'effect'
import * as EAST from 'effect/SchemaAST'
import { describe, expect, test } from 'vitest'
import * as AST from './ast.js'

describe('ast helpers', () => {
  const Tagged = S.Struct({
    _tag: S.Literal('Tagged'),
    value: S.String,
  })

  const Other = S.Struct({
    _tag: S.Literal('Other'),
    count: S.Number,
  })

  const Transformed = S.String.pipe(
    S.decodeTo(
      S.Struct({
        name: S.String,
      }),
      {
        decode: (value) => ({ name: value }),
        encode: (value) => value.name,
      },
    ),
  )

  const LazyTagged = S.suspend(() => Tagged)

  test('resolve follows encoding chains and suspended schemas', () => {
    const transformedResolved = AST.resolve(Transformed.ast)
    const suspendedResolved = AST.resolve(LazyTagged.ast)

    expect(transformedResolved._tag).toBe('String')
    expect(EAST.isObjects(suspendedResolved)).toBe(true)
  })

  test('extractTag reads string literal tags and rejects non-tagged objects', () => {
    expect(AST.extractTag(Tagged.ast as EAST.Objects)).toBe('Tagged')
    expect(
      AST.extractTag(
        S.Struct({
          count: S.Number,
        }).ast as EAST.Objects,
      ),
    ).toBeNull()
  })

  test('getFieldSchema resolves direct and encoded struct fields', () => {
    const valueSchema = AST.getFieldSchema(Tagged, 'value')
    const nameSchema = AST.getFieldSchema(Transformed, 'name')

    expect(valueSchema).toBeDefined()
    expect(nameSchema).toBeDefined()
    expect(S.decodeUnknownSync(valueSchema! as S.Schema<string>)('demo')).toBe('demo')
    expect(S.decodeUnknownSync(nameSchema! as S.Schema<string>)('demo')).toBe('demo')
    expect(AST.getFieldSchema(Tagged, 'missing')).toBeUndefined()
  })

  test('property helpers inspect object fields', () => {
    const ast = Tagged.ast as EAST.Objects

    expect(AST.extractPropertyKeys(ast)).toEqual(['_tag', 'value'])
    expect(AST.getPropertySignature(ast, 'value')?.name).toBe('value')
    expect(AST.getPropertySignature(ast, 'missing')).toBeUndefined()
    expect(AST.hasProperty(ast, '_tag')).toBe(true)
    expect(AST.hasProperty(ast, 'missing')).toBe(false)
    expect(AST.getResolvedPropertyType(ast, 'value')).toBeDefined()
    expect(AST.getResolvedPropertyType(ast, 'missing')).toBeUndefined()
  })

  test('collectTaggedMembers and extractTagsFromUnion ignore untagged members', () => {
    const union = S.Union([
      Tagged,
      Other,
      S.Struct({
        count: S.Number,
      }),
    ])

    const taggedMembers = AST.collectTaggedMembers(union.ast as EAST.Union)

    expect([...taggedMembers.keys()]).toEqual(['Tagged', 'Other'])
    expect(AST.extractTagsFromUnion(union.ast as EAST.Union)).toEqual(['Tagged', 'Other'])
  })

  test('copyAnnotations preserves empty annotations and reapplies populated ones', () => {
    const base = S.String

    expect(AST.copyAnnotations(base, undefined)).toBe(base)
    expect(AST.copyAnnotations(base, {})).toBe(base)

    const annotated = AST.copyAnnotations(base, {
      title: 'Demo',
    })

    expect(annotated).not.toBe(base)
    expect(annotated.ast.annotations?.title).toBe('Demo')
  })
})
