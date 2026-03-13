#!/usr/bin/env bash
# verify-no-new-schema-classes.sh
#
# Verifies that the PR diff does not contain any `new X(...)` calls
# for Schema.Class or TaggedClass instances that should use `.make()`.
#
# Exit 0 = clean, Exit 1 = violations found.

set -euo pipefail

BASE_COMMIT="b22617f2"  # commit before v4 upgrade

# Schema.Class and TaggedClass names found in the codebase.
# These are the classes where `.make()` should be used instead of `new`.
SCHEMA_CLASSES=(
  # cli
  ArgLongFlag ArgShortFlag ArgShortFlagCluster ArgPositional ArgSeparator Param
  # color
  Color
  # conventional-commits
  TargetSection Single Multi Custom Standard Target
  # flo
  Started Completed Failed
  # fs (internal classes)
  AbsDirClass AbsFileClass RelDirClass RelFileClass FileName
  # git
  Commit Author Entry Section Gitignore
  # monorepo
  Config
  # paka
  Example ImportExample SourceLocation JSDocProvenance MdFileProvenance
  Docs Feature Home ModuleDocs DocsProvenance TypeParameter Parameter
  FunctionSignature FunctionSignatureModel BuilderMethod BuilderSignatureModel
  TypeSignatureModel ValueSignatureModel ClassProperty ClassMethod
  ClassSignatureModel Module ValueExport TypeExport
  DrillableNamespaceEntrypoint SimpleEntrypoint PackageMetadata Package
  # pkg
  ComparatorClass ManifestClass DetectedPackageManager Scoped Unscoped
  RangeClass ExactClass Tag WorkspaceClass GitClass Path Url Alias
  # release
  Analysis CascadeImpact Impact ReleaseCommit Plan Official Candidate Ephemeral
  OfficialIncrement OfficialFirst Operator ResolvedOperator Publishing
  ResolvedConfig RuleConfig RuleDefaults ResolvedRuleConfig ResolvedRuleDefaults
  DocLink FixStep GuideFix CommandFix Hint Violation Rule
  PrTitle PrBody RepoSettings GitHistory File Environment
  HasOpenPR HasDiff IsMonorepo HasGitHubAccess HasReleasePlan
  Finished Skipped Report
  CommitDisplay ForecastRelease ForecastCascade Forecast
  # release Severity (Error/Warn handled by prefix match)
  # semver
  OfficialRelease PreRelease
  # tex
  Box BorderEdges BorderCorners Border SpanRange Padding Span Margin Gap
)

# Build a regex pattern from the class names
# Match: `new ClassName(` but NOT inside:
#   - standalone factory functions like `=> new XClass(args)`
#   - Schema decode/transform handlers
#   - comments with `//`
PATTERN=""
for cls in "${SCHEMA_CLASSES[@]}"; do
  if [ -n "$PATTERN" ]; then
    PATTERN="$PATTERN|"
  fi
  PATTERN="${PATTERN}${cls}"
done

echo "Checking PR diff for 'new <SchemaClass>(...)' violations..."
echo "Base commit: $BASE_COMMIT"
echo ""

# Get only added lines from the diff (lines starting with +, excluding +++ headers)
# Use working tree state (not just committed) so uncommitted fixes are reflected
VIOLATIONS=$(git diff "$BASE_COMMIT" -- '*.ts' \
  | grep '^+' \
  | grep -v '^+++' \
  | grep -v '// ' \
  | grep -v '@example' \
  | grep -v '@see' \
  | grep -v '^\+\s*\*' \
  | grep -v 'export const make' \
  | grep -v 'SchemaGetter\.\|SchemaIssue\.\|Transformation\.' \
  | grep -v 'decode.*:' \
  | grep -v 'encode.*:' \
  | grep -vE 'new (Error|Map|Set|Date|URL|RegExp|Proxy|TextEncoder|TextDecoder|Response|Request|Headers|AbortController|Promise|Uint8Array|ArrayBuffer|ReadableStream|WritableStream|TransformStream|FormData|Blob|Worker|Buffer|EventEmitter|Readable)' \
  | grep -E "new ($PATTERN)\(" \
  || true)

if [ -z "$VIOLATIONS" ]; then
  echo "PASS: No 'new <SchemaClass>(...)' violations found in PR diff."
  echo "All Schema.Class/TaggedClass construction uses .make() as required."
  exit 0
else
  echo "FAIL: Found 'new <SchemaClass>(...)' in PR diff. These should use .make() instead:"
  echo ""
  echo "$VIOLATIONS" | head -50
  COUNT=$(echo "$VIOLATIONS" | wc -l | tr -d ' ')
  echo ""
  echo "Total violations: $COUNT"
  exit 1
fi
