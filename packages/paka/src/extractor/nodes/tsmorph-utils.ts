import { type ExportedDeclarations, Node } from 'ts-morph'
import {
  BuilderMethod,
  BuilderMethodCategory,
  BuilderSignatureModel,
  ClassMethod,
  ClassProperty,
  ClassSignatureModel,
  FunctionSignature,
  FunctionSignatureModel,
  Parameter,
  type SignatureModel,
  TypeParameter,
  TypeSignatureModel,
  ValueSignatureModel,
} from '../../schema.js'
import { parseJSDoc } from './jsdoc.js'

/**
 * Simplify TypeScript type text by removing verbose import paths and artifacts.
 *
 * Converts:
 *   import("/Users/.../kit/src/domains/num/non-zero/non-zero").NonZero
 * To:
 *   NonZero
 *
 * Also removes TypeScript's type separator artifacts (leading semicolons).
 */
export const simplifyTypeText = (typeText: string): string => {
  // Remove absolute import paths, keeping only the type name
  // Pattern: import("...").TypeName -> TypeName
  typeText = typeText.replace(/import\("[^"]+"\)\./g, '')

  // Also handle node_modules paths for external packages
  // Pattern: import("...node_modules/.../package").TypeName -> TypeName
  typeText = typeText.replace(/import\("[^"]*node_modules[^"]+"\)\./g, '')

  // Remove ALL leading semicolons - TypeScript adds these as type separators
  // This handles cases like:
  //   ;((type) => type)
  //   ;(<const T>(value: T) => T)
  //   ;(string)
  // We remove ALL leading semicolons and optional whitespace before the actual type
  typeText = typeText.replace(/^;\s*/, '')

  // Remove unnecessary outer parentheses from function types
  // Transform: ((frame: StackFrame) => string) -> (frame: StackFrame) => string
  // But keep: (<T>(value: T) => T) as is (has generics)
  typeText = typeText.replace(/^\((\([^<][^)]*\)\s*=>)/, '$1')

  return typeText
}

/**
 * Extract simple signature from a declaration if it has the __simpleSignature property.
 *
 * The __simpleSignature property is a phantom type marker (Symbol.for('__simpleSignature'))
 * that provides a simplified signature for complex generic functions.
 *
 * @param decl - The declaration to check for simple signature
 * @returns SignatureModel if simple signature exists, undefined otherwise
 */
export const extractSimpleSignature = (decl: ExportedDeclarations): SignatureModel | undefined => {
  // Get the type of the declaration
  const type = decl.getType()

  // Look for the __simpleSignature property
  // TypeScript represents Symbol.for('__simpleSignature') with a special name
  const properties = type.getProperties()
  const simpleSignatureProp = properties.find((prop) =>
    prop.getName().includes('__simpleSignature'),
  )

  if (!simpleSignatureProp) {
    return undefined
  }

  // Get the type of the __simpleSignature property
  const simpleSignatureType = decl
    .getType()
    .getPropertyOrThrow(simpleSignatureProp.getName())
    .getTypeAtLocation(decl)

  // The simple signature is a function type - extract its call signatures
  const callSignatures = simpleSignatureType.getCallSignatures()

  if (callSignatures.length === 0) {
    return undefined
  }

  // Extract all call signatures as function overloads
  const overloads: (typeof FunctionSignature.Type)[] = []

  for (const callSig of callSignatures) {
    // Extract type parameters
    // Note: Signature type parameters are from the TypeScript compiler API, not ts-morph declarations
    const typeParameters: (typeof TypeParameter.Type)[] = []
    for (const tp of callSig.getTypeParameters()) {
      const symbol = tp.getSymbol()
      const name = symbol ? symbol.getName() : tp.getText()
      const constraint = tp.getConstraint()
      const defaultType = tp.getDefault()

      typeParameters.push(
        TypeParameter.make({
          name,
          constraint: constraint ? simplifyTypeText(constraint.getText()) : undefined,
          default: defaultType ? simplifyTypeText(defaultType.getText()) : undefined,
        }),
      )
    }

    // Extract parameters
    const parameters: (typeof Parameter.Type)[] = []
    for (const param of callSig.getParameters()) {
      const paramDecl = param.getValueDeclaration()
      const isOptional =
        paramDecl && Node.isParameterDeclaration(paramDecl) ? paramDecl.isOptional() : false
      const isRest =
        paramDecl && Node.isParameterDeclaration(paramDecl) ? paramDecl.isRestParameter() : false

      parameters.push(
        Parameter.make({
          name: param.getName(),
          type: simplifyTypeText(param.getTypeAtLocation(decl).getText()),
          optional: isOptional,
          rest: isRest,
          defaultValue: undefined,
          description: undefined, // Simple signatures don't have JSDoc
        }),
      )
    }

    // Extract return type
    const returnType = simplifyTypeText(callSig.getReturnType().getText())

    overloads.push(
      FunctionSignature.make({
        typeParameters,
        parameters,
        returnType,
        returnDoc: undefined,
        throws: [],
      }),
    )
  }

  return FunctionSignatureModel.make({
    overloads,
  })
}

/**
 * Extract structured signature from a declaration.
 *
 * Returns a SignatureModel tagged union:
 * - FunctionSignatureModel for functions (with overloads)
 * - TypeSignatureModel for types/interfaces
 * - ValueSignatureModel for const values
 */
export const extractSignature = (decl: ExportedDeclarations): SignatureModel => {
  // Type aliases - keep as text
  if (Node.isTypeAliasDeclaration(decl)) {
    return TypeSignatureModel.make({
      text: decl.getText().replace(/^export\s+/, ''),
    })
  }

  // Interfaces - keep as text
  if (Node.isInterfaceDeclaration(decl)) {
    return TypeSignatureModel.make({
      text: decl.getText().replace(/^export\s+/, ''),
    })
  }

  // Enums - keep as text
  if (Node.isEnumDeclaration(decl)) {
    return TypeSignatureModel.make({
      text: decl.getText(),
    })
  }

  // Function declarations - check for @builder tag first
  if (Node.isFunctionDeclaration(decl)) {
    const jsdoc = parseJSDoc(decl)
    if (jsdoc.isBuilder) {
      return extractBuilderSignature(decl)
    }
    return extractFunctionSignature(decl)
  }

  // Variable declarations (const, let, var)
  if (Node.isVariableDeclaration(decl)) {
    const init = decl.getInitializer()

    // Function expressions/arrow functions - check for @builder tag first
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      const jsdoc = parseJSDoc(decl)
      if (jsdoc.isBuilder) {
        return extractBuilderSignature(init, jsdoc)
      }
      return extractFunctionExpressionSignature(init, jsdoc)
    }

    // Other values - just store the type
    const type = decl.getType()
    const typeText = simplifyTypeText(type.getText())

    return ValueSignatureModel.make({
      type: typeText,
    })
  }

  // Class declarations - extract structured class information
  if (Node.isClassDeclaration(decl)) {
    return extractClassSignature(decl)
  }

  // Namespace/module declarations - keep as text
  if (Node.isModuleDeclaration(decl)) {
    return TypeSignatureModel.make({
      text: decl.getText(),
    })
  }

  // Fallback - get full text as type signature
  return TypeSignatureModel.make({
    text: decl.getText(),
  })
}

/**
 * Extract structured function signature from a function declaration.
 * Handles overloads properly.
 *
 * For functions with overloads, includes both the overload signatures AND
 * the implementation signature, as all are relevant for documentation.
 * Each overload can have its own JSDoc with @param/@returns/@throws.
 */
const extractFunctionSignature = (
  decl: Node & { getOverloads?: () => any[]; getImplementation?: () => any },
): FunctionSignatureModel => {
  const overloads: (typeof FunctionSignature.Type)[] = []

  // Get overload signatures (excluding implementation)
  if (typeof decl.getOverloads === 'function') {
    const overloadDecls = decl.getOverloads()

    for (const overloadDecl of overloadDecls) {
      // Each overload has its own JSDoc
      const jsdoc = parseJSDoc(overloadDecl)
      overloads.push(extractSingleFunctionSignature(overloadDecl, jsdoc))
    }
  }

  // Get implementation signature
  // - If there are overloads, getImplementation() returns the implementation
  // - If there are no overloads, use the declaration itself
  const impl = typeof decl.getImplementation === 'function' ? decl.getImplementation() : null
  const signatureSource = impl || decl

  if (signatureSource) {
    // Implementation signature gets JSDoc from the implementation (or main declaration)
    const jsdoc = parseJSDoc(signatureSource)
    overloads.push(extractSingleFunctionSignature(signatureSource, jsdoc))
  }

  return FunctionSignatureModel.make({
    overloads,
  })
}

/**
 * Extract function signature from arrow function or function expression.
 * JSDoc is typically on the parent variable declaration, not the expression itself.
 */
const extractFunctionExpressionSignature = (
  expr: Node & {
    getTypeParameters?: () => any[]
    getParameters?: () => any[]
    getReturnType?: () => any
  },
  jsdoc?: ReturnType<typeof parseJSDoc>,
): FunctionSignatureModel => {
  const signature = extractSingleFunctionSignature(expr, jsdoc)
  return FunctionSignatureModel.make({
    overloads: [signature],
  })
}

/**
 * Extract a single function signature (one overload).
 *
 * @param fn - The function/method node to extract from
 * @param jsdoc - Optional JSDoc info for parameter/return documentation
 */
const extractSingleFunctionSignature = (
  fn: Node & {
    getTypeParameters?: () => any[]
    getParameters?: () => any[]
    getReturnType?: () => any
  },
  jsdoc?: ReturnType<typeof parseJSDoc>,
): typeof FunctionSignature.Type => {
  // Extract type parameters
  const typeParameters: (typeof TypeParameter.Type)[] = []
  if (typeof fn.getTypeParameters === 'function') {
    for (const tp of fn.getTypeParameters()) {
      const constraint = tp.getConstraint()
      const defaultType = tp.getDefault()

      typeParameters.push(
        TypeParameter.make({
          name: tp.getName(),
          constraint: constraint ? simplifyTypeText(constraint.getText()) : undefined,
          default: defaultType ? simplifyTypeText(defaultType.getText()) : undefined,
        }),
      )
    }
  }

  // Extract parameters
  const parameters: (typeof Parameter.Type)[] = []
  if (typeof fn.getParameters === 'function') {
    for (const param of fn.getParameters()) {
      const isOptional = param.isOptional()
      const isRest = param.isRestParameter()
      const defaultValue = param.getInitializer()
      const paramName = param.getName()

      parameters.push(
        Parameter.make({
          name: paramName,
          type: simplifyTypeText(param.getType().getText()),
          optional: isOptional,
          rest: isRest,
          defaultValue: defaultValue ? defaultValue.getText() : undefined,
          description: jsdoc?.params[paramName],
        }),
      )
    }
  }

  // Extract return type
  let returnType = 'void'
  if (typeof fn.getReturnType === 'function') {
    returnType = simplifyTypeText(fn.getReturnType().getText())
  }

  return FunctionSignature.make({
    typeParameters,
    parameters,
    returnType,
    returnDoc: jsdoc?.returns,
    throws: jsdoc?.throws ?? [],
  })
}

/**
 * Extract builder signature from a function marked with @builder.
 *
 * Automatically crawls the returned builder type interface and classifies methods:
 * - Chainable: Returns the same builder type
 * - Terminal: Returns void
 * - Transform: Returns a different builder type
 */
const extractBuilderSignature = (
  fn: Node & {
    getTypeParameters?: () => any[]
    getParameters?: () => any[]
    getReturnType?: () => any
  },
  jsdoc?: ReturnType<typeof parseJSDoc>,
): BuilderSignatureModel => {
  // Extract entry point signature with JSDoc
  const entryPoint = extractSingleFunctionSignature(fn, jsdoc)

  // Get return type and resolve to interface
  const returnType = typeof fn.getReturnType === 'function' ? fn.getReturnType() : null
  if (!returnType) {
    throw new Error('Builder function must have a return type')
  }

  const symbol = returnType.getSymbol()
  const builderTypeName = symbol?.getName() ?? 'unknown'

  const declarations = symbol?.getDeclarations() ?? []
  const interfaceDecl = declarations[0]

  // Initialize method arrays
  const chainableMethods: (typeof BuilderMethod.Type)[] = []
  const terminalMethods: (typeof BuilderMethod.Type)[] = []
  const transformMethods: (typeof BuilderMethod.Type)[] = []

  // Crawl interface methods if available
  if (interfaceDecl && interfaceDecl.getKindName() === 'InterfaceDeclaration') {
    const iface = interfaceDecl
    const methods = iface.getMethods() as any[]

    // Group methods by name (handle overloads)
    const methodMap = new Map<string, any[]>()
    for (const method of methods) {
      const name = method.getName()
      if (!methodMap.has(name)) {
        methodMap.set(name, [])
      }
      methodMap.get(name)!.push(method)
    }

    // Process each method group
    for (const [name, overloads] of methodMap) {
      // Extract all overload signatures with JSDoc
      const overloadSignatures: (typeof FunctionSignature.Type)[] = []
      for (const overload of overloads) {
        const methodJsdoc = parseJSDoc(overload)
        overloadSignatures.push(extractSingleFunctionSignature(overload, methodJsdoc))
      }

      // Classify based on first overload's return type
      const firstOverload = overloads[0]!
      const methodReturnType = firstOverload.getReturnType()
      const methodReturnTypeText = simplifyTypeText(methodReturnType.getText())
      const methodReturnSymbol = methodReturnType.getSymbol()

      let category: typeof BuilderMethodCategory.Type
      let transformsTo: string | undefined

      if (methodReturnTypeText === 'void') {
        category = 'terminal'
      } else if (methodReturnSymbol?.getName() === builderTypeName) {
        category = 'chainable'
      } else if (methodReturnSymbol) {
        category = 'transform'
        transformsTo = methodReturnSymbol.getName()
      } else {
        // Default to terminal for unknown types
        category = 'terminal'
      }

      // Create BuilderMethod
      const builderMethod = BuilderMethod.make({
        name,
        overloads: overloadSignatures,
        category,
        transformsTo,
      })

      // Add to appropriate array
      if (category === 'chainable') {
        chainableMethods.push(builderMethod)
      } else if (category === 'terminal') {
        terminalMethods.push(builderMethod)
      } else if (category === 'transform') {
        transformMethods.push(builderMethod)
      }
    }
  }

  return BuilderSignatureModel.make({
    typeName: builderTypeName,
    entryPoint,
    chainableMethods,
    terminalMethods,
    transformMethods,
  })
}

/**
 * Extract structured class signature.
 *
 * Extracts constructor, properties, and methods from a class declaration.
 */
const extractClassSignature = (classDecl: any): ClassSignatureModel => {
  // Extract constructor
  let ctor: typeof FunctionSignature.Type | undefined
  const constructors = classDecl.getConstructors()
  if (constructors.length > 0) {
    const constructorDecl = constructors[0]
    const jsdoc = parseJSDoc(constructorDecl)
    const className = classDecl.getName() || 'unknown'

    // Extract constructor signature (constructor has no return type, but we use class name)
    const ctorSig = extractSingleFunctionSignature(constructorDecl, jsdoc)
    ctor = FunctionSignature.make({
      typeParameters: ctorSig.typeParameters,
      parameters: ctorSig.parameters,
      returnType: className, // Constructor "returns" the class instance
      returnDoc: ctorSig.returnDoc,
      throws: ctorSig.throws,
    })
  }

  // Extract properties
  const properties: (typeof ClassProperty.Type)[] = []
  for (const prop of classDecl.getProperties()) {
    const propName = prop.getName()
    const propType = simplifyTypeText(prop.getType().getText())
    const isOptional = prop.hasQuestionToken() || false
    const isReadonly = prop.isReadonly()
    const isStatic = prop.isStatic()
    const jsdoc = parseJSDoc(prop)

    properties.push(
      ClassProperty.make({
        name: propName,
        type: propType,
        optional: isOptional,
        readonly: isReadonly,
        static: isStatic,
        description: jsdoc.description,
      }),
    )
  }

  // Extract methods
  const methods: (typeof ClassMethod.Type)[] = []

  // Group methods by name (handle overloads)
  const methodMap = new Map<string, any[]>()
  for (const method of classDecl.getMethods()) {
    const name = method.getName()
    if (!methodMap.has(name)) {
      methodMap.set(name, [])
    }
    methodMap.get(name)!.push(method)
  }

  // Process each method group
  for (const [name, overloads] of methodMap) {
    const isStatic = overloads[0]?.isStatic() || false

    // Extract all overload signatures with JSDoc
    const overloadSignatures: (typeof FunctionSignature.Type)[] = []
    for (const overload of overloads) {
      const methodJsdoc = parseJSDoc(overload)
      overloadSignatures.push(extractSingleFunctionSignature(overload, methodJsdoc))
    }

    methods.push(
      ClassMethod.make({
        name,
        overloads: overloadSignatures,
        static: isStatic,
      }),
    )
  }

  return ClassSignatureModel.make({
    ctor,
    properties,
    methods,
  })
}
