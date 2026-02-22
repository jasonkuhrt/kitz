# GitHub Releases Integration Design

## Overview

Add GitHub release creation to the @kitz/release workflow, enabling per-package concurrent release creation after tag pushing.

## Workflow Structure

**Before:**

```
Preflight ─┬─→ Publish:A ─→ CreateTag:A ─┬─→ PushTags (all at once)
           ├─→ Publish:B ─→ CreateTag:B ─┤
           └─→ Publish:C ─→ CreateTag:C ─┘
```

**After:**

```
Preflight ─┬─→ Publish:A ─→ CreateTag:A ─→ PushTag:A ─→ CreateGHRelease:A
           ├─→ Publish:B ─→ CreateTag:B ─→ PushTag:B ─→ CreateGHRelease:B
           └─→ Publish:C ─→ CreateTag:C ─→ PushTag:C ─→ CreateGHRelease:C
```

**Benefits:**

- Each package's full pipeline runs independently
- GitHub releases happen as soon as their tag is pushed
- Better progress visibility in terminal UI
- If one package fails, others continue unaffected

## GitHub Integration

### Approach: `gh` CLI via Effect Command

Use `@effect/platform` Command module to call `gh` CLI:

```typescript
import { Command } from '@effect/platform'

const command = Command.make('gh', 'release', 'create', tag,
  '--title', `${packageName} v${version}`,
  '--notes', changelog,
)

yield* Command.exitCode(command)
```

**Rationale:**

- `gh` handles auth automatically (existing `gh auth login`)
- Native Effect integration via Command module
- No new dependencies - `@effect/platform` already used by workflow engine
- Matches design doc's "GitHub-only" platform decision

### Release Body Content

Generate changelog from commits via `@kitz/changelog`:

```typescript
const body = Changelog.generateMarkdown({
  version: release.nextVersion,
  commits: release.commits,
  packageName: release.packageName,
})
```

**Release title format:** `@kitz/core v1.2.0`

## Preview Releases

Mutable `@next` releases that accumulate changes:

```typescript
if (isPreview) {
  // Check if @next release exists
  const exists = yield * Command.exitCode(
    Command.make('gh', 'release', 'view', tag),
  ).pipe(
    Effect.map(code => code === 0),
    Effect.catchAll(() => Effect.succeed(false)),
  )

  if (exists) {
    // Update existing
    yield * Command.exitCode(
      Command.make('gh', 'release', 'edit', tag, '--notes', body),
    )
  } else {
    // Create new with --prerelease
    yield * Command.exitCode(
      Command.make(
        'gh',
        'release',
        'create',
        tag,
        '--title',
        `${packageName} @next`,
        '--notes',
        body,
        '--prerelease',
      ),
    )
  }
} else {
  // Stable release
  yield * Command.exitCode(
    Command.make(
      'gh',
      'release',
      'create',
      tag,
      '--title',
      `${packageName} v${version}`,
      '--notes',
      body,
    ),
  )
}
```

## Error Handling

New error type:

```typescript
export class WorkflowGHReleaseError
  extends Schema.TaggedError<WorkflowGHReleaseError>(
    'WorkflowGHReleaseError',
  )('WorkflowGHReleaseError', {
    tag: Schema.String,
    message: Schema.String,
  })
{}
```

Added to `ReleaseWorkflowError` union.

**Retry:** `{ times: 2 }` for network resilience.

## Implementation Checklist

- [ ] Split `PushTags` into per-package `PushTag:${tag}` activities
- [ ] Add `CreateGHRelease:${tag}` activities after each push
- [ ] Add `WorkflowGHReleaseError` to error union
- [ ] Import `Command` from `@effect/platform`
- [ ] Verify `@kitz/changelog` API for release body generation
- [ ] Update tests for new workflow structure
