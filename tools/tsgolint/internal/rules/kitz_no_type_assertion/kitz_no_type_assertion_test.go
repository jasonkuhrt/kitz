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
declare const sink: <T>(value: T extends string ? never : T) => T

function nested<const T extends string>(value: T): T {
  return sink<T>(value as any)
}
`},
		{Code: `
declare const accept: <T>(value: T extends string ? never : T) => void

function bodyLevel<const T extends string>(value: T): T {
  accept<T>(value as any)
  return value
}
`},
		{Code: `
declare const accept: <T>(value: T extends string ? never : T) => void

const fn = <const T extends string>(value: T): T => {
  accept<T>(value as any)
  return value
}
`},
		{Code: `
declare const decode: <T>(value: T extends string ? never : T) => T

const api = {
  fromString: (<const T extends string>(
    value: T extends string ? never : T,
  ) => {
    return decode(value as any) as any
  }) as any,
}
`},
	}, []rule_tester.InvalidTestCase{
		{
			Code: `
function simple<T>(value: T): T {
  return value as any
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
function unnecessary<const T extends readonly unknown[]>(
  value: T extends readonly [infer Head, ...infer Tail] ? Head : T,
): T extends readonly [infer Head, ...infer Tail] ? Head : T {
  const copy: unknown = value as any
  return value
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
function nonReturn<const T extends readonly unknown[]>(
  value: T extends readonly [infer Head, ...infer Tail] ? Head : T,
): T extends readonly [infer Head, ...infer Tail] ? Head : T {
  const local = value as any
  return value
}
`,
			Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noTypeAssertion"}},
		},
		{
			Code: `
function nonAny(value: unknown) {
  return value as string
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
