#!/usr/bin/env bash
set -euo pipefail

check_only=0

if [[ "${1:-}" == "--check" ]]; then
  check_only=1
fi

patterns=(
  '*.js'
  '*.jsx'
  '*.ts'
  '*.tsx'
  '*.mjs'
  '*.cjs'
  '*.mts'
  '*.cts'
  '*.json'
  '*.toml'
)

is_ignored() {
  local path="$1"

  case "$path" in
    .claude/*) return 0 ;;
    .serena/*) return 0 ;;
    */__snapshots__/*) return 0 ;;
    tools/oxlint-custom-rules/tests/fixtures/*) return 0 ;;
    packages/core/src/obj/diff.test-d.ts) return 0 ;;
    packages/core/src/ts/simplify.test-d.ts) return 0 ;;
  esac

  return 1
}

changed=()

while IFS= read -r -d '' path; do
  if is_ignored "$path"; then
    continue
  fi

  tmp="$(mktemp)"
  ./node_modules/.bin/oxfmt --stdin-filepath "$path" <"$path" >"$tmp"

  if cmp -s "$path" "$tmp"; then
    rm -f "$tmp"
    continue
  fi

  changed+=("$path")

  if [[ "$check_only" -eq 1 ]]; then
    rm -f "$tmp"
    continue
  fi

  mv "$tmp" "$path"
done < <(git ls-files -z -- "${patterns[@]}")

if [[ "$check_only" -eq 1 ]]; then
  if [[ "${#changed[@]}" -eq 0 ]]; then
    echo 'All tracked files use the correct format.'
    exit 0
  fi

  echo 'Formatting differences found:' >&2
  printf '  %s\n' "${changed[@]}" >&2
  exit 1
fi

if [[ "${#changed[@]}" -eq 0 ]]; then
  echo 'No formatting changes needed.'
  exit 0
fi

echo "Formatted ${#changed[@]} files."
