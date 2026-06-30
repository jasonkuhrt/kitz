#!/usr/bin/env bash
# Stop: if this session edited any TypeScript, run the project typecheck.
# tsc -b is whole-program (no per-file mode), so this runs once at session end
# and only when TS actually changed. On failure, surface to Claude via exit 2.
input=$(cat)
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty')
[ -n "$transcript" ] || exit 0
transcript="${transcript/#\~/$HOME}"
[ -f "$transcript" ] || exit 0

# Only run when this session used Edit/Write AND touched a .ts/.tsx file.
grep -Eq '"name"[[:space:]]*:[[:space:]]*"(Edit|Write)"' "$transcript" || exit 0
grep -Eq '"file_path"[[:space:]]*:[[:space:]]*"[^"]+\.(ts|mts|cts|tsx)"' "$transcript" || exit 0

if ! out=$(pnpm exec vp run check:types 2>&1); then
  printf 'Type check failed:\n%s\n' "$out" >&2
  exit 2
fi
exit 0
