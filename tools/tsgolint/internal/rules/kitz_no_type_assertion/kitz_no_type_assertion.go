package kitz_no_type_assertion

import (
	"regexp"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
	"github.com/typescript-eslint/tsgolint/internal/utils"
)

var testFilePattern = regexp.MustCompile(`(?:\.(?:test|spec)(?:-d)?|\.bench-d)\.[cm]?[jt]sx?$`)

func buildNoTypeAssertionMessage() rule.RuleMessage {
	return rule.RuleMessage{
		Id:          "noTypeAssertion",
		Description: "Remove assertion casts; use schema decode/typed constructors.",
	}
}

func normalizePath(path string) string {
	return strings.ReplaceAll(path, "\\", "/")
}

func isTestFilePath(path string) bool {
	normalized := normalizePath(path)
	return strings.Contains(normalized, "/__tests__/") || testFilePattern.MatchString(normalized)
}

func isConstAssertionTypeNode(typeNode *ast.Node) bool {
	if typeNode == nil {
		return false
	}
	if typeNode.Kind == ast.KindConstKeyword {
		return true
	}
	if ast.IsTypeReferenceNode(typeNode) {
		typeName := typeNode.AsTypeReference().TypeName
		return ast.IsIdentifier(typeName) && typeName.Text() == "const"
	}
	return false
}

var KitzNoTypeAssertionRule = rule.Rule{
	Name: "no-unsafe-type-assertion",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		_ = options

		if isTestFilePath(ctx.SourceFile.FileName()) {
			return rule.RuleListeners{}
		}

		getEnclosingFunction := func(node *ast.Node) *ast.Node {
			return utils.GetParentFunctionNode(node)
		}

		isWithinFunctionBody := func(node *ast.Node, functionNode *ast.Node) bool {
			if functionNode == nil {
				return false
			}
			body := functionNode.Body()
			if body == nil {
				return false
			}

			current := node
			for current != nil && current != functionNode {
				if current == body {
					return true
				}
				current = current.Parent
			}
			return false
		}

		isAllowedImplementationAssertion := func(node *ast.Node) bool {
			functionNode := getEnclosingFunction(node)
			if !isWithinFunctionBody(node, functionNode) {
				return false
			}
			return !isConstAssertionTypeNode(node.Type())
		}

		checkAssertion := func(node *ast.Node) {
			if isConstAssertionTypeNode(node.Type()) && getEnclosingFunction(node) == nil {
				return
			}

			if isAllowedImplementationAssertion(node) {
				return
			}

			ctx.ReportNode(node, buildNoTypeAssertionMessage())
		}

		return rule.RuleListeners{
			ast.KindAsExpression:            checkAssertion,
			ast.KindTypeAssertionExpression: checkAssertion,
		}
	},
}
