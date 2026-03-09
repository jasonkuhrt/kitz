# Optic

Optics are composable abstractions for reading and updating data structures. This module provides optics at two levels:

1. **Runtime optics** - operate on data values (`get`, `set`, `update`)
2. **Comptime optics** - operate on TypeScript types (`Get<>`, `Set<>`)

The term "optic" is an umbrella for various related concepts (lens, prism, traversal, etc.).

## Operations

The core API consists of a small set of polymorphic operations that work across different optic types.

| Operation | Purpose               | Signature                               |
| --------- | --------------------- | --------------------------------------- |
| `get`     | Read focused value(s) | `(data, optic) → T \| Option<T> \| T[]` |
| `set`     | Write new value       | `(data, optic, value) → S`              |
| `update`  | Modify with function  | `(data, optic, fn) → S`                 |
| `reduce`  | Aggregate values      | `(data, optic, fn, init) → R`           |

### get

Read the focused value(s). Return type depends on the optic:

```typescript
// Lens, Iso → T (guaranteed single value)
Optic.get(user, Optic.at('name')) // → 'Alice'
Optic.get(user, '.name') // → 'Alice' (expression DSL)

// Optional, Prism → Option<T> (may not exist)
Optic.get(users, Optic.ix(0)) // → Option<User>
Optic.get(users, '[0]') // → Option<User>

// Traversal → T[] (multiple values)
Optic.get(users, Optic.each) // → User[]
Optic.get(users, '.[].name') // → string[]
```

### set

Write a new value at the focused position(s):

```typescript
Optic.set(user, Optic.at('name'), 'Bob') // → { ...user, name: 'Bob' }
Optic.set(user, '.address.city', 'LA') // → deep immutable update
Optic.set(items, '.[].active', true) // → set all to active
```

### update

Modify the focused value(s) with a function:

```typescript
Optic.update(user, Optic.at('age'), (n) => n + 1)
Optic.update(players, '.[].score', (n) => n * 2)
```

### reduce

Aggregate multiple focused values (works on Traversal, Fold):

```typescript
Optic.reduce(items, '.[].price', (acc, p) => acc + p, 0) // → total
Optic.reduce(posts, '.[].tags.[]', (acc, t) => [...acc, t], []) // → all tags
```

## Utilities

### flow

Compose optics left-to-right:

```typescript
const addressCity = Optic.flow(Optic.at('address'), Optic.at('city'))

const firstUserName = Optic.flow(Optic.ix(0), Optic.at('name'))

// Composition determines the resulting optic type:
// Lens + Lens = Lens
// Lens + Optional = Optional
// Optional + Lens = Optional
// Any + Traversal = Traversal
```

### builder

Construct optics without data:

```typescript
const lens = Optic.builder.at('address').at('city') // → composed Lens
Optic.get(user, lens) // → 'NYC'
Optic.set(user, lens, 'LA') // → updated user
```

### on

Fluent API with data:

```typescript
Optic.on(user).at('address').at('city').get() // → 'NYC'

Optic.on(user).at('address').at('city').set('LA') // → updated user

Optic.on(users).each().at('name').get() // → ['Alice', 'Bob']
```

## Constructors

Create optics using constructor functions:

| Constructor    | Type      | Focus | Trait        | Expression | Use case                             |
| -------------- | --------- | ----- | ------------ | ---------- | ------------------------------------ |
| `at(key)`      | Lens      | 1     | `Fielded<K>` | `.<key>`   | Known struct property or tuple index |
| `ix(key)`      | Optional  | 0-1   | `Indexed<K>` | `[<key>]`  | Array index or record key            |
| `entries`      | Iso       | 1     | `Entried`    | `@x:x`     | Object ↔ entries                     |
| `each`         | Traversal | 0-n   | `Iterable`   | `.[]`      | All elements                         |
| `filter(pred)` | Traversal | 0-n   | `Iterable`   | -          | Elements matching predicate          |
| `values`       | Traversal | 0-n   | `Entried`    | `@_:x`     | All values                           |
| `keys`         | Traversal | 0-n   | `Entried`    | `@x:_`     | All keys                             |
| `tag(name)`    | Prism     | 0-1   | `Tagged<T>`  | `@<tag>`   | Tagged union case                    |

```typescript
// Lens (Fielded<K> - guaranteed access)
Optic.at('name') // object property
Optic.at(0) // tuple index

// Optional (Indexed<K> - fallible access)
Optic.ix(0) // array index
Optic.ix('id') // record key

// Iso (Entried)
Optic.entries // object ↔ entries

// Traversal (Iterable)
Optic.each // all elements
Optic.filter((x) => x.active) // elements matching predicate

// Traversal (Entried)
Optic.values // all values
Optic.keys // all keys

// Prism (Tagged<T>)
Optic.tag('circle') // tagged union case
```

## Optic Types

Optic types are bundles of supported operations:

| Type          | get returns | set | update | reduce |
| ------------- | ----------- | --- | ------ | ------ |
| **Lens**      | `T`         | ✓   | ✓      | -      |
| **Iso**       | `T`         | ✓   | ✓      | -      |
| **Optional**  | `Option<T>` | ✓   | ✓      | -      |
| **Prism**     | `Option<T>` | ✓   | ✓      | -      |
| **Traversal** | `T[]`       | ✓   | ✓      | ✓      |

### Focus Cardinality

- **1** - Exactly one element (Lens, Iso)
- **0-1** - Zero or one element (Optional, Prism)
- **0-n** - Zero or more elements (Traversal)

### When to use which

- **Lens** - Known object properties, tuple indices (`at`)
- **Optional** - Array indices, record keys (`ix`)
- **Prism** - Tagged union cases (`tag`)
- **Traversal** - All elements, filtered elements, values, keys (`each`, `filter`, `values`, `keys`)
- **Iso** - Lossless bidirectional transforms (`entries`)

## API Variants

### Curried (optic-first)

```typescript
Optic.getWith(optic) // → (data) => value
Optic.setWith(optic, value) // → (data) => updated data
Optic.updateWith(optic, fn) // → (data) => updated data

// Usage
users.map(Optic.getWith(Optic.at('name'))) // → ['Alice', 'Bob']
```

### Curried (data-first)

```typescript
Optic.getOn(data) // → (optic) => value
Optic.setOn(data) // → (optic, value) => updated data
Optic.updateOn(data) // → (optic, fn) => updated data

// Usage
const fromUser = Optic.getOn(user)
fromUser('.name') // → 'Alice'
fromUser('.address') // → { city: 'NYC' }
```

## Type-Level Optics

Type-level optics extract and transform parts of TypeScript types at compile time.

### Core Operations

| Operation           | Purpose      | Example                                                     |
| ------------------- | ------------ | ----------------------------------------------------------- |
| `Get<lens, T>`      | Extract type | `Get<Awaited.$Get, Promise<string>>` → `string`             |
| `Set<lens, T, New>` | Replace type | `Set<Returned.$Set, () => string, number>` → `() => number` |

### Available Lenses

| Lens           | Focus                  | Example                     |
| -------------- | ---------------------- | --------------------------- |
| `Awaited`      | Promise inner type     | `Promise<T>` → `T`          |
| `Returned`     | Function return type   | `() => T` → `T`             |
| `Parameters`   | All function params    | `(a, b) => void` → `[a, b]` |
| `Parameter1-5` | Specific param         | `(a, b) => void` → `a`      |
| `Array`        | Array element          | `T[]` → `T`                 |
| `Tuple`        | Tuple element by index | `[A, B]` → `A` or `B`       |
| `Property`     | Object property        | `{ x: T }` → `T`            |
| `Indexed`      | Index signature value  | `Record<string, T>` → `T`   |

### Expression DSL

Compose lenses using string expressions:

| Syntax  | Lens       | Example                                                    |
| ------- | ---------- | ---------------------------------------------------------- |
| `.prop` | Property   | `Get<'.user.name', { user: { name: string } }>` → `string` |
| `#`     | Awaited    | `Get<'#', Promise<number>>` → `number`                     |
| `>`     | Returned   | `Get<'>', () => boolean>` → `boolean`                      |
| `()`    | Parameters | `Get<'()', (a: string) => void>` → `[string]`              |
| `(N)`   | ParameterN | `Get<'(0)', (a: string) => void>` → `string`               |
| `[]`    | Array      | `Get<'[]', string[]>` → `string`                           |
| `[N]`   | Tuple      | `Get<'[0]', [string, number]>` → `string`                  |

Expressions compose left-to-right:

```typescript
type T = Get<'.handler>#', { handler: () => Promise<number> }> // number
```
