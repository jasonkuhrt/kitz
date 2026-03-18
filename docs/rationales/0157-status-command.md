# 0157 Durable Workflow Status Command

## Context

Release execution already persists workflow progress, but operators had no first-class command for checking whether the active plan had started, suspended, or completed.

## Decision

Add a `release status` command that derives the same workflow identity as `release apply`, polls the durable workflow runtime for that plan, and renders an operator-facing summary.

## Result

Operators can inspect persisted release state without spelunking through the SQLite database or guessing from logs, and resume guidance is surfaced directly when a workflow is suspended.
