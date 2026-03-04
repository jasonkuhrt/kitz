package kitz_no_type_assertion

import (
	"regexp"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
	"github.com/typescript-eslint/tsgolint/internal/utils"
)

var testFilePattern = regexp.MustCompile(`(?:\.(?:test|spec)(?:-d)?|\.bench-d)\.[cm]?[jt]sx?$`)

const complexPragma = "@kitz-complex"

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

func isAdvancedTypeSyntaxNode(node *ast.Node) bool {
	if node == nil {
		return false
	}
	switch node.Kind {
	case ast.KindConditionalType,
		ast.KindInferType,
		ast.KindMappedType,
		ast.KindIndexedAccessType,
		ast.KindTemplateLiteralType,
		ast.KindImportType,
		ast.KindTypeOperator:
		return true
	default:
		return false
	}
}

func hasAdvancedTypeSyntax(node *ast.Node) bool {
	if node == nil {
		return false
	}
	if isAdvancedTypeSyntaxNode(node) {
		return true
	}

	found := false
	node.ForEachChild(func(child *ast.Node) bool {
		if hasAdvancedTypeSyntax(child) {
			found = true
		}
		return false
	})

	return found
}

func signatureHasAdvancedType(functionNode *ast.Node) bool {
	if functionNode == nil {
		return false
	}

	for _, typeParameter := range functionNode.TypeParameters() {
		if hasAdvancedTypeSyntax(typeParameter) {
			return true
		}
	}

	for _, parameter := range functionNode.Parameters() {
		if hasAdvancedTypeSyntax(parameter.Type()) {
			return true
		}
	}

	return hasAdvancedTypeSyntax(functionNode.Type())
}

func isComplexSignature(functionNode *ast.Node) bool {
	if functionNode == nil {
		return false
	}
	if len(functionNode.TypeParameters()) == 0 {
		return false
	}
	return signatureHasAdvancedType(functionNode)
}

func getPragmaAnchorNode(functionNode *ast.Node) *ast.Node {
	if functionNode == nil {
		return nil
	}

	anchor := functionNode
	parent := functionNode.Parent
	if parent == nil {
		return anchor
	}

	if ast.IsVariableDeclaration(parent) && parent.Initializer() == functionNode {
		declarationList := parent.Parent
		if declarationList != nil && ast.IsVariableDeclarationList(declarationList) {
			if variableStatement := declarationList.Parent; variableStatement != nil && ast.IsVariableStatement(variableStatement) {
				return variableStatement
			}
		}
		return parent
	}

	if ast.IsPropertyAssignment(parent) && parent.Initializer() == functionNode {
		return parent
	}

	return anchor
}

func hasPragmaOnSameOrPreviousLine(sourceText string, start int) bool {
	if start <= 0 || start > len(sourceText) {
		return false
	}

	lineStart := strings.LastIndex(sourceText[:start], "\n") + 1
	sameLinePrefix := strings.TrimSpace(sourceText[lineStart:start])
	if strings.Contains(sameLinePrefix, complexPragma) {
		return true
	}

	if lineStart == 0 {
		return false
	}

	previousLineEnd := lineStart - 1
	if previousLineEnd > 0 && sourceText[previousLineEnd-1] == '\r' {
		previousLineEnd--
	}

	previousLineStart := strings.LastIndex(sourceText[:previousLineEnd], "\n") + 1
	previousLine := strings.TrimSpace(sourceText[previousLineStart:previousLineEnd])
	if previousLine == "" {
		return false
	}

	return strings.Contains(previousLine, complexPragma)
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

		isWithinComplexFunctionBody := func(node *ast.Node) bool {
			for functionNode := getEnclosingFunction(node); functionNode != nil; functionNode = getEnclosingFunction(functionNode.Parent) {
				if !isWithinFunctionBody(node, functionNode) {
					continue
				}
				pragmaAnchor := getPragmaAnchorNode(functionNode)
				pragmaStart := utils.TrimNodeTextRange(ctx.SourceFile, pragmaAnchor).Pos()
				hasComplexPragma := hasPragmaOnSameOrPreviousLine(ctx.SourceFile.Text(), pragmaStart)
				if isComplexSignature(functionNode) || hasComplexPragma {
					return true
				}
			}
			return false
		}

		isAllowedImplementationAssertion := func(node *ast.Node) bool {
			if !isWithinComplexFunctionBody(node) {
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
