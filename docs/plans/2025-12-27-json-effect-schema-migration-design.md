# @kitz/json Effect Schema Migration

Migrate @kitz/json to use Effect Schema properly, removing the @kitz/codec dependency.

## Context

- @kitz/json currently uses @kitz/codec for encode/decode operations
- @kitz/codec is redundant now that kitz builds on Effect
- The package already has Effect Schemas but wraps them in a Codec abstraction
- This migration aligns @kitz/json with the fs path schemas pattern (module-as-namespace)

## Design

### Types (unchanged)

```typescript
export type Primitive = string | number | boolean | null
export type Obj = { [key in string]?: Value }
export type Value = Primitive | Obj | Value[]
export { type Obj as Object }
```

### Component Schemas

```typescript
export const PrimitiveSchema = S.Union(S.String, S.Number, S.Boolean, S.Null)

export const ValueSchema: S.Schema<Value> = S.suspend(() =>
  S.Union(PrimitiveSchema, S.Array(ValueSchema), S.Record({ key: S.String, value: ValueSchema })),
)

export const ObjectSchema = S.Record({ key: S.String, value: ValueSchema })
```

### Primary Schema

```typescript
export const Schema = S.parseJson(ValueSchema, { space: 2 }).annotations({
  identifier: 'Json',
  title: 'JSON Value',
  description: 'A valid JSON value parsed from/serialized to a string',
})
```

### Convenience Functions

```typescript
export const is = S.is(ValueSchema)
export const isPrimitive = S.is(PrimitiveSchema)
export const isObject = S.is(ObjectSchema)
export const fromString = S.decodeSync(Schema)
export const toString = S.encodeSync(Schema)
```

## What Gets Removed

- `import { Codec } from '@kitz/codec'` - dependency removed
- `export const codec` - replaced by `Schema`
- `export const encode` - replaced by `toString`
- `export const decode` - replaced by `fromString`
- `export const parseJsonSchema` - users compose with `Schema` directly
- `export const parseJsonAs` - users compose with `S.parseJson(theirSchema)`
- Manual type guard implementations - replaced by `S.is()` calls
- `Primitive.parse`, `Value.parse`, `ObjectParser.parse` - redundant with `fromString`

## API Migration

| Old API              | New API                |
| -------------------- | ---------------------- |
| `Json.encode(value)` | `Json.toString(value)` |
| `Json.decode(str)`   | `Json.fromString(str)` |
| `Json.isValue(x)`    | `Json.is(x)`           |
| `Json.codec`         | `Json.Schema`          |

## Consumer Impact

- **@kitz/fs**: No changes needed (only uses `Json.Object` and `Json.Value` types)
- **@kitz/kitz**: Auto-updated via re-export
- **External**: Breaking changes to function names (see migration table)

## Post-Migration

After @kitz/json is migrated, delete @kitz/codec package entirely.
