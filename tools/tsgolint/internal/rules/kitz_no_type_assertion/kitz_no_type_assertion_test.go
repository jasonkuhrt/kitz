package kitz_no_type_assertion

import (
	"sync"
	"testing"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/bundled"
	"github.com/microsoft/typescript-go/shim/tspath"
	"github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
	"github.com/microsoft/typescript-go/shim/vfs/osvfs"
	"github.com/typescript-eslint/tsgolint/internal/diagnostic"
	"github.com/typescript-eslint/tsgolint/internal/linter"
	"github.com/typescript-eslint/tsgolint/internal/rule"
	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
	"github.com/typescript-eslint/tsgolint/internal/utils"

	"gotest.tools/v3/assert"
)

func TestKitzNoTypeAssertionRule(t *testing.T) {
	t.Parallel()

	rule_tester.RunRuleTester(fixtures.GetRootDir(), "tsconfig.minimal.json", t, &KitzNoTypeAssertionRule, []rule_tester.ValidTestCase{
		{Code: "const tuple = [1, 2, 3] as const"},
		{Code: `
declare const coerce: <T>(value: T extends readonly string[] ? never : T) => T

function fromString<const T extends readonly string[]>(
  value: T,
): T extends readonly [infer Head, ...infer Tail] ? Head : never {
  return coerce<T>(value as any) as any
}
`},
		{Code: `
function parseRecord<const T extends Record<string, unknown>>(
  value: T,
): T extends Record<string, unknown> ? T : never {
  const record = value as Record<string, number>
  return record as any
}
`},
		{Code: `
function withNested<const T extends readonly string[]>(
  value: T,
): T extends readonly [infer Head, ...infer Tail] ? Head : never {
  const run = () => value as any
  return run() as any
}
`},
		{Code: `
function angle<const T extends readonly string[]>(
  value: T,
): T extends readonly [infer Head, ...infer Tail] ? Head : never {
  return <any>value
}
`},
		{Code: `
// @kitz-complex
function forcedComplex(value: unknown) {
  return value as any
}
`},
		{Code: `
// @kitz-complex
const forcedArrow = (value: unknown) => {
  return value as Record<string, number>
}
`},
		{Code: `
class Service {
  parse<const T extends readonly string[]>(
    value: T,
  ): T extends readonly [infer Head, ...infer Tail] ? Head : never {
    return value as Record<string, number>
  }
}
`},
	}, []rule_tester.InvalidTestCase{
		{
			Code: `
function simple(value: unknown) {
  return value as any
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
function simpleObject(value: unknown) {
  return value as object
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
function genericOnly<T>(value: T): T {
  return value as any
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
const value = {} as any
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
const api = {
  fromString: (<const T extends readonly string[]>(
    value: T,
  ): T extends readonly [infer Head, ...infer Tail] ? Head : never => {
    return value as any
  }) as any,
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
function badConst<const T extends readonly string[]>(
  value: T,
): T extends readonly [infer Head, ...infer Tail] ? Head : never {
  return value as const
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
// @kitz-complex

function markerTooFar(value: unknown) {
  return value as any
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
	})
}

func TestKitzNoTypeAssertionRule_TestFileExemption(t *testing.T) {
	t.Parallel()

	diagnostics := runRuleOnFile(t, "sample.test.ts", `
const value = ({} as string)
`)

	assert.Equal(t, len(diagnostics), 0)
}

func runRuleOnFile(t *testing.T, fileName string, code string) []rule.RuleDiagnostic {
	t.Helper()

	rootDir := fixtures.GetRootDir()
	cachedFS := cachedvfs.From(bundled.WrapFS(osvfs.FS()))
	virtualFiles := map[string]string{tspath.ResolvePath(rootDir, fileName): code}
	fs := utils.NewOverlayVFS(cachedFS, virtualFiles)
	host := utils.CreateCompilerHost(rootDir, fs)

	program, _, err := utils.CreateProgram(true, fs, rootDir, "tsconfig.minimal.json", host)
	assert.NilError(t, err)

	sourceFile := program.GetSourceFile(fileName)
	if sourceFile == nil {
		t.Fatalf("source file not found in program: %s", fileName)
	}

	diagnostics := make([]rule.RuleDiagnostic, 0)
	var diagnosticsMu sync.Mutex

	err = linter.RunLinterOnProgram(
		utils.LogLevelNormal,
		program,
		[]*ast.SourceFile{sourceFile},
		1,
		func(sourceFile *ast.SourceFile) []linter.ConfiguredRule {
			return []linter.ConfiguredRule{{
				Name: "test",
				Run: func(ctx rule.RuleContext) rule.RuleListeners {
					return KitzNoTypeAssertionRule.Run(ctx, nil)
				},
			}}
		},
		func(diagnostic rule.RuleDiagnostic) {
			diagnosticsMu.Lock()
			defer diagnosticsMu.Unlock()
			diagnostics = append(diagnostics, diagnostic)
		},
		func(diagnostic.Internal) {},
		linter.Fixes{Fix: true, FixSuggestions: true},
		linter.TypeErrors{ReportSyntactic: false, ReportSemantic: false},
	)
	assert.NilError(t, err)

	return diagnostics
}
