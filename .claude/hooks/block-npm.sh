#!/usr/bin/env bash
# PreToolUse(Bash): make npm/npx a semantic error. This repo uses pnpm + vp only.
# npm ignores publishConfig.exports (npm/cli#7586), so `npm publish` would ship the
# dev .ts exports instead of the built .js — block it before it can run.
# Matches npm/npx only at a command-word boundary, so pnpm and paths are unaffected.
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -n "$cmd" ] || exit 0
if printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_.+-])(npm|npx)([[:space:]]|$)'; then
  printf 'Blocked: this repo uses pnpm + vp, never npm/npx.\n%s\n' \
    "Use pnpm (e.g. 'pnpm install', 'pnpm exec vp run <task>'). npm ignores publishConfig.exports, so it would publish the wrong package shape." >&2
  exit 2
fi
exit 0
