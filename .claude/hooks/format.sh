#!/usr/bin/env bash
# PostToolUse(Edit|Write): auto-format the edited file via oxfmt (best-effort).
# Never blocks — formatting is a convenience, not a gate (the pre-commit hook +
# CI are the real gate). Reads the Claude Code tool envelope from stdin.
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0
case "$file" in
  */.claude/*|*/docs/*|*/build/*|*/coverage/*|*/node_modules/*|*/.tsbuild/*) exit 0 ;;
  *.ts|*.mts|*.cts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.jsonc|*.md|*.yaml|*.yml)
    pnpm exec vp format "$file" >/dev/null 2>&1 || true
    ;;
esac
exit 0
