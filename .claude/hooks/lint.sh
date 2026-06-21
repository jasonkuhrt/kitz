#!/usr/bin/env bash
# PostToolUse(Edit|Write): lint the edited TypeScript file via oxlint.
# On failure, write the report to stderr and exit 2 so Claude Code feeds it back
# to the agent for an immediate fix. Reads the tool envelope from stdin.
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0
case "$file" in
  */.claude/*|*/docs/*|*/build/*|*/coverage/*|*/node_modules/*|*/.tsbuild/*) exit 0 ;;
esac
case "$file" in
  *.ts|*.mts|*.cts|*.tsx)
    if ! out=$(pnpm exec vp lint "$file" 2>&1); then
      printf 'oxlint found issues in %s:\n%s\n' "$file" "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
