#!/bin/bash

input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

# Lint TypeScript files with oxlint
case "$file_path" in
  *.ts|*.tsx)
    cd "$CLAUDE_PROJECT_DIR"
    if ! output=$(pnpm oxlint --config .oxlintrc.json "$file_path" 2>&1); then
      echo "Linting failed for $file_path:"
      echo "$output"
      exit 1
    fi
    ;;
esac

exit 0
