# Feature Request: Workflow Activity Event Stream

## Summary

Add `Workflow.observe(executionId): Stream<WorkflowEvent>` to observe activity lifecycle events in real-time.

## Motivation

`execute()` blocks until completion, `poll()` returns final state. For long-running workflows, there's no way to observe progress. The storage layer already persists state after each activity - the gap is a streaming observation API.

## Proposed API

```typescript
// Stream of workflow events - dogfoods Effect's Stream
const events: Stream<WorkflowEvent> = yield * Workflow.observe(executionId)

type WorkflowEvent =
  | { _tag: 'ActivityStarted'; activity: string }
  | { _tag: 'ActivityCompleted'; activity: string }
  | { _tag: 'ActivityFailed'; activity: string; error: unknown }
  | { _tag: 'WorkflowCompleted'; result: unknown }
  | { _tag: 'WorkflowFailed'; error: unknown }
```

## Use Cases

- Terminal progress visualization
- Monitoring dashboards
- Debugging long-running workflows
