#!/usr/bin/env sh
# Create a cold-startable GitHub issue in the repo's permitted format.
#
# Usage: file-issue.sh <bug|feature> "<title>" <body-file>
#
# - bug      -> label "bug"
# - feature  -> label "enhancement"
#
# The body file must already follow the format enforced by SKILL.md:
#   bug:     "# Expected behaviour" / "# Actual"
#   feature: "# Current behaviour" / "# Desired behaviour"
# with point-form bullets only under each heading.
set -eu

REPO="jasonkuhrt/kitz"

kind=${1:-}
title=${2:-}
body_file=${3:-}

if [ -z "$kind" ] || [ -z "$title" ] || [ -z "$body_file" ]; then
  echo "Usage: file-issue.sh <bug|feature> \"<title>\" <body-file>" >&2
  exit 2
fi

if [ ! -f "$body_file" ]; then
  echo "Body file not found: $body_file" >&2
  exit 2
fi

case "$kind" in
  bug) label="bug" ;;
  feature) label="enhancement" ;;
  *)
    echo "Unknown kind: $kind (expected 'bug' or 'feature')" >&2
    exit 2
    ;;
esac

# Dedupe hint: surface any open issue whose title shares the summary text.
summary=$(printf '%s' "$title" | sed 's/^[a-z!.]*([^)]*)://; s/^[a-z!.]*://' | tr -s ' ')
echo "Checking for possible duplicates matching:$summary" >&2
gh issue list --repo "$REPO" --state open --search "$summary" --limit 5 >&2 || true
echo "---" >&2

gh issue create \
  --repo "$REPO" \
  --title "$title" \
  --label "$label" \
  --body-file "$body_file"
