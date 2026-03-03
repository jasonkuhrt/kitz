package kitz_no_type_assertion

import (
	"regexp"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/checker"
	"github.com/typescript-eslint/tsgolint/internal/rule"
	"github.com/typescript-eslint/tsgolint/internal/utils"
)

var testFilePattern = regexp.MustCompile(`(?:\.(?:test|spec)(?:-d)?|\.bench-d)\.[cm]?[jt]sx?$`)

type complexityInfo struct {
	hasGeneric  bool
	hasAdvanced bool
}

func (c *complexityInfo) merge(other complexityInfo) {
	c.hasGeneric = c.hasGeneric || other.hasGeneric
	c.hasAdvanced = c.hasAdvanced || other.hasAdvanced
}

func (c complexityInfo) isComplex() bool {
	return c.hasGeneric && c.hasAdvanced
}

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

func isAnyTypeNode(typeNode *ast.Node) bool {
	return typeNode != nil && typeNode.Kind == ast.KindAnyKeyword
}

func isObjectLiteralType(t *checker.Type) bool {
	return utils.IsObjectType(t) && checker.Type_objectFlags(t)&checker.ObjectFlagsObjectLiteral != 0
}

func isAdvancedTypeSyntaxNode(node *ast.Node) bool {
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

func typeParametersForNode(node *ast.Node) []*ast.Node {
	if node == nil {
		return nil
	}
	switch node.Kind {
	case ast.KindArrowFunction,
		ast.KindFunctionDeclaration,
		ast.KindFunctionExpression,
		ast.KindCallSignature,
		ast.KindConstructSignature,
		ast.KindConstructorType,
		ast.KindFunctionType,
		ast.KindMethodSignature,
		ast.KindMethodDeclaration,
		ast.KindClassDeclaration,
		ast.KindClassExpression,
		ast.KindInterfaceDeclaration,
		ast.KindTypeAliasDeclaration:
		return node.TypeParameters()
	default:
		return nil
	}
}

func analyzeTypeSyntax(node *ast.Node, visited map[*ast.Node]struct{}) complexityInfo {
	info := complexityInfo{}
	if node == nil {
		return info
	}
	if _, ok := visited[node]; ok {
		return info
	}
	visited[node] = struct{}{}

	if node.Kind == ast.KindTypeParameter || len(typeParametersForNode(node)) > 0 {
		info.hasGeneric = true
	}
	if isAdvancedTypeSyntaxNode(node) {
		info.hasAdvanced = true
	}

	node.ForEachChild(func(child *ast.Node) bool {
		info.merge(analyzeTypeSyntax(child, visited))
		return false
	})

	return info
}

func analyzeFunctionSignatureSyntax(functionNode *ast.Node) complexityInfo {
	info := complexityInfo{}
	if functionNode == nil {
		return info
	}

	visited := map[*ast.Node]struct{}{}

	typeParameters := typeParametersForNode(functionNode)
	if len(typeParameters) > 0 {
		info.hasGeneric = true
	}
	for _, typeParameter := range typeParameters {
		info.merge(analyzeTypeSyntax(typeParameter, visited))
	}

	for _, parameter := range functionNode.Parameters() {
		if parameterType := parameter.Type(); parameterType != nil {
			info.merge(analyzeTypeSyntax(parameterType, visited))
		}
	}

	if returnType := functionNode.Type(); returnType != nil {
		info.merge(analyzeTypeSyntax(returnType, visited))
	}

	return info
}

func analyzeTypeDeclarations(typeSymbol *ast.Symbol, visited map[*ast.Node]struct{}) complexityInfo {
	info := complexityInfo{}
	if typeSymbol == nil {
		return info
	}

	for _, declaration := range typeSymbol.Declarations {
		if declaration == nil {
			continue
		}
		if ast.IsFunctionLikeDeclaration(declaration) {
			info.merge(analyzeFunctionSignatureSyntax(declaration))
			continue
		}
		info.merge(analyzeTypeSyntax(declaration, visited))
	}

	return info
}

var KitzNoTypeAssertionRule = rule.Rule{
	Name: "no-unsafe-type-assertion",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		_ = options

		if isTestFilePath(ctx.SourceFile.FileName()) {
			return rule.RuleListeners{}
		}

		var analyzeTypeComplexity func(t *checker.Type, seenTypes map[*checker.Type]struct{}, seenNodes map[*ast.Node]struct{}) complexityInfo
		analyzeTypeComplexity = func(t *checker.Type, seenTypes map[*checker.Type]struct{}, seenNodes map[*ast.Node]struct{}) complexityInfo {
			info := complexityInfo{}
			if t == nil {
				return info
			}
			if _, ok := seenTypes[t]; ok {
				return info
			}
			seenTypes[t] = struct{}{}

			flags := checker.Type_flags(t)
			if flags&checker.TypeFlagsTypeParameter != 0 {
				info.hasGeneric = true
			}
			if flags&(checker.TypeFlagsConditional|checker.TypeFlagsIndexedAccess|checker.TypeFlagsTemplateLiteral|checker.TypeFlagsSubstitution) != 0 {
				info.hasAdvanced = true
			}

			if alias := checker.Type_alias(t); alias != nil {
				aliasTypeArguments := alias.TypeArguments()
				if len(aliasTypeArguments) > 0 {
					info.hasGeneric = true
					for _, typeArgument := range aliasTypeArguments {
						info.merge(analyzeTypeComplexity(typeArgument, seenTypes, seenNodes))
					}
				}
				info.merge(analyzeTypeDeclarations(alias.Symbol(), seenNodes))
			}

			if symbol := checker.Type_symbol(t); symbol != nil {
				info.merge(analyzeTypeDeclarations(symbol, seenNodes))
			}

			if utils.IsUnionType(t) || utils.IsIntersectionType(t) {
				for _, typePart := range t.Types() {
					info.merge(analyzeTypeComplexity(typePart, seenTypes, seenNodes))
				}
			}

			if flags&checker.TypeFlagsIndexedAccess != 0 {
				indexedAccessType := t.AsIndexedAccessType()
				info.merge(analyzeTypeComplexity(checker.IndexedAccessType_objectType(indexedAccessType), seenTypes, seenNodes))
				info.merge(analyzeTypeComplexity(checker.IndexedAccessType_indexType(indexedAccessType), seenTypes, seenNodes))
			}

			if flags&checker.TypeFlagsConditional != 0 {
				conditionalType := t.AsConditionalType()
				info.merge(analyzeTypeComplexity(checker.ConditionalType_checkType(conditionalType), seenTypes, seenNodes))
				info.merge(analyzeTypeComplexity(checker.ConditionalType_extendsType(conditionalType), seenTypes, seenNodes))
			}

			if flags&checker.TypeFlagsTemplateLiteral != 0 {
				for _, typePart := range t.Types() {
					info.merge(analyzeTypeComplexity(typePart, seenTypes, seenNodes))
				}
			}

			if flags&checker.TypeFlagsObject != 0 {
				objectFlags := checker.Type_objectFlags(t)
				if objectFlags&(checker.ObjectFlagsMapped|checker.ObjectFlagsInstantiatedMapped|checker.ObjectFlagsReverseMapped) != 0 {
					info.hasAdvanced = true
				}

				if objectFlags&checker.ObjectFlagsReference != 0 {
					typeArguments := checker.Checker_getTypeArguments(ctx.TypeChecker, t)
					if len(typeArguments) > 0 {
						info.hasGeneric = true
					}
					for _, typeArgument := range typeArguments {
						info.merge(analyzeTypeComplexity(typeArgument, seenTypes, seenNodes))
					}
				}

				if objectFlags&checker.ObjectFlagsMapped != 0 {
					mappedType := t.AsMappedType()
					info.hasAdvanced = true
					info.merge(analyzeTypeComplexity(checker.MappedType_typeParameter(mappedType), seenTypes, seenNodes))
					info.merge(analyzeTypeComplexity(checker.MappedType_constraintType(mappedType), seenTypes, seenNodes))
					info.merge(analyzeTypeComplexity(checker.MappedType_templateType(mappedType), seenTypes, seenNodes))
				}

				for _, signature := range ctx.TypeChecker.GetCallSignatures(t) {
					if len(signature.TypeParameters()) > 0 {
						info.hasGeneric = true
					}
					for _, typeParameter := range signature.TypeParameters() {
						info.hasGeneric = true
						info.merge(analyzeTypeComplexity(typeParameter, seenTypes, seenNodes))
					}
					for _, parameter := range checker.Signature_parameters(signature) {
						info.merge(analyzeTypeComplexity(checker.Checker_getTypeOfSymbol(ctx.TypeChecker, parameter), seenTypes, seenNodes))
					}
					info.merge(analyzeTypeComplexity(ctx.TypeChecker.GetReturnTypeOfSignature(signature), seenTypes, seenNodes))
				}

				for _, signature := range ctx.TypeChecker.GetConstructSignatures(t) {
					if len(signature.TypeParameters()) > 0 {
						info.hasGeneric = true
					}
					for _, typeParameter := range signature.TypeParameters() {
						info.hasGeneric = true
						info.merge(analyzeTypeComplexity(typeParameter, seenTypes, seenNodes))
					}
					for _, parameter := range checker.Signature_parameters(signature) {
						info.merge(analyzeTypeComplexity(checker.Checker_getTypeOfSymbol(ctx.TypeChecker, parameter), seenTypes, seenNodes))
					}
					info.merge(analyzeTypeComplexity(ctx.TypeChecker.GetReturnTypeOfSignature(signature), seenTypes, seenNodes))
				}

				info.merge(analyzeTypeComplexity(ctx.TypeChecker.GetStringIndexType(t), seenTypes, seenNodes))
				info.merge(analyzeTypeComplexity(ctx.TypeChecker.GetNumberIndexType(t), seenTypes, seenNodes))
			}

			return info
		}

		getEnclosingFunction := func(node *ast.Node) *ast.Node {
			return utils.GetParentFunctionNode(node)
		}

		isWithinReturnedExpression := func(node *ast.Node, functionNode *ast.Node) bool {
			if functionNode == nil {
				return false
			}

			if ast.IsArrowFunction(functionNode) {
				body := functionNode.Body()
				if body != nil && !ast.IsBlock(body) {
					current := node
					for current != nil && current != functionNode {
						if current == body {
							return true
						}
						current = current.Parent
					}
					return false
				}
			}

			current := node
			for current != nil && current != functionNode {
				if ast.IsReturnStatement(current) {
					return current.AsReturnStatement().Expression != nil
				}
				current = current.Parent
			}
			return false
		}

		getFunctionReturnType := func(functionNode *ast.Node) *checker.Type {
			if functionNode == nil {
				return nil
			}

			if returnTypeNode := functionNode.Type(); returnTypeNode != nil {
				result := checker.Checker_getTypeFromTypeNode(ctx.TypeChecker, returnTypeNode)
				if ast.HasSyntacticModifier(functionNode, ast.ModifierFlagsAsync) {
					awaited := checker.Checker_getAwaitedType(ctx.TypeChecker, result)
					if awaited != nil {
						return awaited
					}
				}
				return result
			}

			var functionType *checker.Type
			if ast.IsFunctionExpression(functionNode) || ast.IsArrowFunction(functionNode) {
				functionType = utils.GetContextualType(ctx.TypeChecker, functionNode)
			}
			if functionType == nil {
				functionType = ctx.TypeChecker.GetTypeAtLocation(functionNode)
			}
			if functionType == nil {
				return nil
			}

			signatures := utils.CollectAllCallSignatures(ctx.TypeChecker, functionType)
			if len(signatures) == 0 {
				return nil
			}

			result := checker.Checker_getReturnTypeOfSignature(ctx.TypeChecker, signatures[0])
			if ast.HasSyntacticModifier(functionNode, ast.ModifierFlagsAsync) {
				awaited := checker.Checker_getAwaitedType(ctx.TypeChecker, result)
				if awaited != nil {
					return awaited
				}
			}

			return result
		}

		getPropertyInitializerTargetType := func(node *ast.Node) *checker.Type {
			parent := node.Parent
			if !ast.IsPropertyAssignment(parent) || parent.Initializer() != node {
				return nil
			}
			objectLiteral := parent.Parent
			if !ast.IsObjectLiteralExpression(objectLiteral) {
				return nil
			}

			objectType := checker.Checker_getContextualType(ctx.TypeChecker, objectLiteral, checker.ContextFlagsNone)
			if objectType == nil {
				return nil
			}

			propertyName := ast.GetTextOfPropertyName(parent.Name())
			if propertyName == "" {
				return nil
			}

			apparentType := checker.Checker_getApparentType(ctx.TypeChecker, objectType)
			propertySymbol := checker.Checker_getPropertyOfType(ctx.TypeChecker, apparentType, propertyName)
			if propertySymbol == nil {
				propertySymbol = checker.Checker_getPropertyOfType(ctx.TypeChecker, objectType, propertyName)
			}
			if propertySymbol != nil {
				if propertyType := ctx.TypeChecker.GetTypeOfSymbolAtLocation(propertySymbol, parent); propertyType != nil {
					return propertyType
				}
				return ctx.TypeChecker.GetTypeOfSymbolAtLocation(propertySymbol, node)
			}

			if stringIndex := ctx.TypeChecker.GetStringIndexType(objectType); stringIndex != nil {
				return stringIndex
			}
			return ctx.TypeChecker.GetNumberIndexType(objectType)
		}

		getContextualTargetType := func(node *ast.Node) *checker.Type {
			if propertyTarget := getPropertyInitializerTargetType(node); propertyTarget != nil {
				return propertyTarget
			}
			if contextual := utils.GetContextualType(ctx.TypeChecker, node); contextual != nil {
				return contextual
			}
			if contextual := checker.Checker_getContextualType(ctx.TypeChecker, node, checker.ContextFlagsNone); contextual != nil {
				return contextual
			}

			functionNode := getEnclosingFunction(node)
			if functionNode == nil {
				return nil
			}
			if !isWithinReturnedExpression(node, functionNode) {
				return nil
			}

			return getFunctionReturnType(functionNode)
		}

		isRequiredAnyAssertion := func(node *ast.Node) bool {
			expression := node.Expression()
			expressionType := ctx.TypeChecker.GetTypeAtLocation(expression)
			if utils.IsIntrinsicErrorType(expressionType) {
				return true
			}

			targetType := getContextualTargetType(node)
			if targetType == nil {
				return false
			}

			expressionTypeToAssign := expressionType
			if isObjectLiteralType(expressionType) {
				expressionTypeToAssign = checker.Checker_getWidenedType(ctx.TypeChecker, expressionType)
			}

			if checker.Checker_isTypeAssignableTo(ctx.TypeChecker, expressionTypeToAssign, targetType) {
				return false
			}

			return true
		}

		isComplexContext := func(node *ast.Node) bool {
			if functionNode := getEnclosingFunction(node); functionNode != nil {
				if analyzeFunctionSignatureSyntax(functionNode).isComplex() {
					return true
				}
			}

			if contextualType := getContextualTargetType(node); contextualType != nil {
				if analyzeTypeComplexity(contextualType, map[*checker.Type]struct{}{}, map[*ast.Node]struct{}{}).isComplex() {
					return true
				}
			}

			expressionType := ctx.TypeChecker.GetTypeAtLocation(node.Expression())
			if analyzeTypeComplexity(expressionType, map[*checker.Type]struct{}{}, map[*ast.Node]struct{}{}).isComplex() {
				return true
			}

			return false
		}

		isBridgePosition := func(node *ast.Node, functionNode *ast.Node) bool {
			if isWithinReturnedExpression(node, functionNode) {
				return true
			}

			parent := node.Parent
			if ast.IsPropertyAssignment(parent) && parent.Initializer() == node {
				return true
			}

			if (ast.IsCallExpression(parent) || ast.IsNewExpression(parent)) && parent.Expression() != node {
				for _, argument := range parent.Arguments() {
					if argument == node {
						return true
					}
				}
			}

			return false
		}

		isAllowedAnyAssertion := func(node *ast.Node) bool {
			if !isAnyTypeNode(node.Type()) {
				return false
			}
			functionNode := getEnclosingFunction(node)
			if !isComplexContext(node) {
				return false
			}
			if isWithinReturnedExpression(node, functionNode) {
				return true
			}
			if isRequiredAnyAssertion(node) {
				return true
			}
			if getContextualTargetType(node) != nil {
				return false
			}
			return isBridgePosition(node, functionNode)
		}

		checkAssertion := func(node *ast.Node) {
			if isConstAssertionTypeNode(node.Type()) && getEnclosingFunction(node) == nil {
				return
			}

			if isAllowedAnyAssertion(node) {
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
