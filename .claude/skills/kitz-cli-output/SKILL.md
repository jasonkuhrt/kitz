---
name: kitz-cli-output
description: This skill should be used when writing CLI output, logging multiple lines, printing status messages, formatting console output, using Console.log repeatedly, or building multi-line strings for display. Covers efficient output patterns using Str.Builder and Effect Console.
---

# CLI Output

Efficient patterns for CLI output in Effect-based applications using `@kitz/core` and Effect.

## Core Pattern

**Build multi-line output with `Str.Builder`, flush once with `Console.log`:**

```typescript
import { Str } from '@kitz/core'
import { Console, Effect } from 'effect'

const program = Effect.gen(function*() {
  const b = Str.Builder()

  b`Applying release plan...`
  b`${totalReleases} packages to release`
  b``
  b`This will:`
  b`  1. Run preflight checks`
  b`  2. Publish all packages`
  b`  3. Create git tags`
  b``
  b`Use --yes to skip this prompt.`

  yield* Console.log(b.render())
})
```

## Static Blocks

For static text (no loops, no conditionals), prefer `Str.Tpl.dedent`:

```typescript
yield * Console.log(Str.Tpl.dedent`
  Done! Release is ready.

  Next steps:
    1. Review release.config.ts
    2. Run \`release status\` to see pending changes
`)
```

Single expression, no `.render()`. Use `Str.Builder` when content is dynamic.

## Anti-Pattern: Multiple Console Calls

```typescript
// BAD - Multiple flushes to stdout
yield * Console.log(`Applying release plan...`)
yield * Console.log(`${totalReleases} packages to release`)
yield * Console.log()
yield * Console.log(`This will:`)
yield * Console.log(`  1. Run preflight checks`)
// ... more calls

// GOOD - Single flush
const b = Str.Builder()
b`Applying release plan...`
b`${totalReleases} packages to release`
// ... build all lines
yield * Console.log(b.render())
```

## Str.Builder Syntax

**Prefer tagged template syntax:**

```typescript
const b = Str.Builder()

// Tagged template (preferred)
b`Line one`
b`Value: ${someValue}`
b`` // Empty line

// Function syntax (for conditional content)
b(condition ? 'shown' : null) // null filtered out
b(useColors ? styled('text') : 'text')
```

| Syntax     | Use When                              |
| ---------- | ------------------------------------- |
| `b\`...\`` | Static strings, simple interpolation  |
| `b(...)`   | Conditional content, computed strings |
| `b\`\``    | Empty lines                           |

## Dynamic Content in Loops

```typescript
const b = Str.Builder()
b`Releases:`

for (const r of releases) {
  b`  ${r.package.name}@${r.version}`
}

b``
b`Total: ${releases.length} packages`

yield * Console.log(b.render())
```

## Conditional Sections

```typescript
const b = Str.Builder()
b`Status: ${status}`

if (warnings.length > 0) {
  b``
  b`Warnings:`
  for (const w of warnings) {
    b`  - ${w}`
  }
}

yield * Console.log(b.render())
```

## Error Output

Use `Console.error` for errors, still build with `Str.Builder`:

```typescript
const b = Str.Builder()
b`Error: ${message}`
b``
b`Stack trace:`
b`${stack}`

yield * Console.error(b.render())
```

## Streaming Output

When output must appear incrementally (progress, real-time events), individual `Console.log` calls are appropriate:

```typescript
// Real-time event stream - individual calls OK
const eventFiber = yield * events.pipe(
  Stream.tap((event) => {
    switch (event._tag) {
      case 'Started':
        return Console.log(`  Starting: ${event.activity}`)
      case 'Completed':
        return Console.log(`Done: ${event.activity}`)
      case 'Failed':
        return Console.error(`Failed: ${event.activity}`)
      default:
        return Effect.void
    }
  }),
  Stream.runDrain,
  Effect.fork,
)
```

## Configuration

```typescript
// Default: join with newlines
const b = Str.Builder()

// Custom join (e.g., inline)
const inline = Str.Builder({ join: '' })
inline`part1`
inline`part2`
inline.render() // "part1part2"

// Multiple lines per call
b(header.render(), body.render(), footer.render())
```

## When to Use What

| Scenario                     | Approach                       |
| ---------------------------- | ------------------------------ |
| Static multi-line            | `Str.Tpl.dedent`               |
| Dynamic (loops/conditionals) | `Str.Builder`                  |
| Real-time progress/events    | Individual `Console.log` calls |
| Single line                  | Direct `Console.log`           |
