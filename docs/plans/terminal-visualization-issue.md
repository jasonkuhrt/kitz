# Terminal Visualization for Workflow Execution

## Summary

Add terminal visualization during `@kitz/release` workflow execution, showing activity progress with dynamic coloring and ASCII diagrams.

## Requirements

1. **ASCII terminal diagram**: Render workflow as visual diagram
2. **Dynamic coloring by progress state**:
   - 🟢 Green: Completed activities
   - 🟡 Yellow: Currently executing activity
   - 🔴 Red: Failed activities
   - ⚪ Gray: Pending activities
3. **TTY detection**: Auto-enable visualization if TTY, disable otherwise
4. **Override option**: `--visualize` flag to force on/off
5. **Streaming output**: Real-time updates as activities complete

## Dependency

**Blocked on upstream**: `@effect/workflow` lacks activity lifecycle events/streaming API.

See: [effect-workflow-streaming-feature-request.md](./effect-workflow-streaming-feature-request.md)

## Potential Workarounds

If upstream doesn't add this soon, we could:

### Option 1: Storage Wrapper (Recommended)

Wrap the storage layer to emit events when activities complete:

```typescript
import { MessageStorage } from '@effect/cluster'
import { Layer, PubSub } from 'effect'

const makeObservableStorage = (baseStorage: MessageStorage) =>
  Layer.effect(
    MessageStorage,
    Effect.gen(function*() {
      const pubsub = yield* PubSub.unbounded<WorkflowEvent>()

      return {
        ...baseStorage,
        saveReply: (envelope) =>
          baseStorage.saveReply(envelope).pipe(
            Effect.tap(() =>
              pubsub.publish({
                _tag: 'ActivityCompleted',
                activity: envelope.activity,
                // ...
              })
            ),
          ),
        // Subscribe to events
        events: PubSub.subscribe(pubsub),
      }
    }),
  )
```

**Pros**: Works today, no upstream changes needed
**Cons**: Fragile if storage API changes, more maintenance burden

### Option 2: Polling with Heuristics

Poll SQLite database directly for workflow state changes:

```typescript
const pollProgress = (dbPath: string, executionId: string) =>
  Stream.repeatEffectWithSchedule(
    readWorkflowState(dbPath, executionId),
    Schedule.spaced('100 millis'),
  ).pipe(
    Stream.changes, // Only emit when state changes
  )
```

**Pros**: Doesn't require modifying storage layer
**Cons**: Polling overhead, may miss rapid changes, requires understanding SQLite schema

### Option 3: Log Parsing

Parse Effect log output for activity markers:

```typescript
// Activities already log: "Starting activity: Publish:@kitz/core"
// Parse these from log stream
```

**Pros**: Zero code changes to workflow
**Cons**: Very fragile, log format could change

## Recommended Approach

1. **Short term**: Submit feature request to Effect repo, use **Option 1 (Storage Wrapper)** as interim solution
2. **Long term**: Migrate to upstream streaming API when available

## Visualization Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Release Workflow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [✓] Preflight ────────────────────────────────────────────┐│
│                                                             ││
│  [✓] Publish:@kitz/core ───────────────────────────────────┤│
│                                                             ││
│  [●] Publish:@kitz/release ◄── (current)                   ││
│                                                             ││
│  [ ] CreateTag:@kitz/core@1.0.0                            ││
│                                                             ││
│  [ ] CreateTag:@kitz/release@1.0.0                         ││
│                                                             ││
│  [ ] PushTags                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Legend: [✓] Done  [●] Running  [✗] Failed  [ ] Pending
```

## Implementation Tasks

Once streaming is available:

1. [ ] Create `TerminalRenderer` module with ASCII diagram generation
2. [ ] Implement TTY detection (use `process.stdout.isTTY`)
3. [ ] Add `--visualize` CLI option
4. [ ] Connect renderer to activity event stream
5. [ ] Add ANSI color codes for progress states
6. [ ] Handle non-TTY fallback (simple log lines)
7. [ ] Add tests for renderer logic
