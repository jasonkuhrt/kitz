// @ts-check

import path from 'node:path'
import { definePlugin, defineRule } from 'oxlint'

/** @typedef {import('oxlint').ESTree.Expression} Expression */
/** @typedef {import('oxlint').ESTree.MemberExpression} MemberExpression */
/** @typedef {import('oxlint').ESTree.TSType} TSType */
/** @typedef {import('oxlint').ESTree.TSTypeName} TSTypeName */

const MESSAGE_IDS = {
  noJsonParse: `noJsonParse`,
  noTryCatch: `noTryCatch`,
  noNativePromiseConstruction: `noNativePromiseConstruction`,
  noTypeAssertion: `noTypeAssertion`,
  noNativeMapSetInEffectModules: `noNativeMapSetInEffectModules`,
  noThrow: `noThrow`,
  noPromiseThenChain: `noPromiseThenChain`,
  noEffectRunInLibraryCode: `noEffectRunInLibraryCode`,
  requireTypedEffectErrors: `requireTypedEffectErrors`,
  requireSchemaDecodeAtBoundary: `requireSchemaDecodeAtBoundary`,
}

const MESSAGES = {
  [MESSAGE_IDS.noJsonParse]: `Use Effect Schema JSON codec/decode at IO boundaries.`,
  [MESSAGE_IDS.noTryCatch]: `Use Effect.try, Effect.tryPromise, Either, Option, typed error channels.`,
  [MESSAGE_IDS.noNativePromiseConstruction]: `Use Effect constructors/combinators.`,
  [MESSAGE_IDS.noTypeAssertion]: `Remove assertion casts; use schema decode/typed constructors.`,
  [MESSAGE_IDS.noNativeMapSetInEffectModules]: `Prefer Effect HashMap / HashSet (mutable variants only when justified).`,
  [MESSAGE_IDS.noThrow]: `Use typed Effect failures instead of throw (except approved boundary adapters).`,
  [MESSAGE_IDS.noPromiseThenChain]: `Prefer Effect combinators over Promise.then/catch/finally chains.`,
  [MESSAGE_IDS.noEffectRunInLibraryCode]: `Do not run Effects in library code; return Effects and run them in app/CLI entrypoints or tests.`,
  [MESSAGE_IDS.requireTypedEffectErrors]: `Use precise typed Effect error channels; avoid any/unknown in Effect error position.`,
  [MESSAGE_IDS.requireSchemaDecodeAtBoundary]: `Boundary modules that read env/http/file input must decode with Effect Schema.`,
}

/**
 * @param {unknown} node
 * @returns {node is { type: 'Identifier'; name: string }}
 */
const isIdentifier = (node) =>
  typeof node === `object` && node !== null && `type` in node && node.type === `Identifier`

/**
 * @param {Expression} expression
 * @returns {expression is MemberExpression}
 */
const isMemberExpression = (expression) => expression.type === `MemberExpression`

/**
 * @param {MemberExpression} memberExpression
 * @returns {string | null}
 */
const getPropertyName = (memberExpression) => {
  if (!memberExpression.computed) {
    return isIdentifier(memberExpression.property) ? memberExpression.property.name : null
  }

  if (memberExpression.property.type === `Literal` && typeof memberExpression.property.value === `string`) {
    return memberExpression.property.value
  }

  return null
}

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isJsonObjectReference = (expression) => {
  if (isIdentifier(expression) && expression.name === `JSON`) {
    return true
  }

  if (!isMemberExpression(expression)) {
    return false
  }

  if (!isIdentifier(expression.object) || expression.object.name !== `globalThis`) {
    return false
  }

  return getPropertyName(expression) === `JSON`
}

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isPromiseConstructorReference = (expression) => {
  if (isIdentifier(expression) && expression.name === `Promise`) {
    return true
  }

  if (!isMemberExpression(expression)) {
    return false
  }

  if (!isIdentifier(expression.object) || expression.object.name !== `globalThis`) {
    return false
  }

  return getPropertyName(expression) === `Promise`
}

/**
 * @param {TSTypeName} typeName
 * @returns {string | null}
 */
const getTypeName = (typeName) => {
  if (typeName.type === `Identifier`) {
    return typeName.name
  }

  if (typeName.type === `TSQualifiedName`) {
    return typeName.right.name
  }

  return null
}

/**
 * @param {string} filePath
 * @returns {string}
 */
const normalizePath = (filePath) => filePath.split(path.sep).join(`/`)

/**
 * @param {import('oxlint').Context} context
 * @returns {string}
 */
const getNormalizedRelativePath = (context) => normalizePath(path.relative(context.cwd, context.filename))

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isTestFilePath = (filePath) =>
  filePath.includes(`/__tests__/`) || /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(filePath)

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isReleaseEffectModule = (filePath) =>
  filePath.includes(`/packages/release/src/`) || filePath.startsWith(`packages/release/src/`)

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isBoundaryAdapterFile = (filePath) => {
  if (isTestFilePath(filePath)) {
    return true
  }

  return (
    filePath.includes(`/src/cli/`) ||
    filePath.includes(`/src/app/`) ||
    filePath.includes(`/src/entrypoint/`) ||
    filePath.includes(`/src/adapters/`) ||
    filePath.includes(`/src/adaptors/`) ||
    filePath.includes(`/src/live/`) ||
    filePath.includes(`/bin/`) ||
    filePath.endsWith(`/cli.ts`) ||
    filePath.endsWith(`/main.ts`) ||
    filePath.endsWith(`/entrypoint.ts`)
  )
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isEffectRunAllowedFile = (filePath) => isBoundaryAdapterFile(filePath)

/**
 * @param {Expression} expression
 * @returns {boolean}
 */
const isEffectReference = (expression) => isIdentifier(expression) && expression.name === `Effect`

/**
 * @param {string | null} name
 * @returns {boolean}
 */
const isEffectRunMethodName = (name) => name !== null && (name === `run` || /^run[A-Z]/.test(name))

/**
 * @param {TSTypeName} typeName
 * @returns {boolean}
 */
const isEffectTypeName = (typeName) => {
  if (typeName.type === `Identifier`) {
    return typeName.name === `Effect`
  }

  if (typeName.type === `TSQualifiedName`) {
    return (
      typeName.right.name === `Effect` &&
      typeName.left.type === `Identifier` &&
      typeName.left.name === `Effect`
    )
  }

  return false
}

/**
 * @param {TSType} typeAnnotation
 * @returns {boolean}
 */
const isAnyOrUnknownType = (typeAnnotation) =>
  typeAnnotation.type === `TSAnyKeyword` || typeAnnotation.type === `TSUnknownKeyword`

/**
 * @param {MemberExpression} memberExpression
 * @returns {boolean}
 */
const isProcessEnvMember = (memberExpression) => {
  if (getPropertyName(memberExpression) !== `env`) {
    return false
  }

  return isIdentifier(memberExpression.object) && memberExpression.object.name === `process`
}

/**
 * @param {import('oxlint').ESTree.CallExpression} callExpression
 * @returns {boolean}
 */
const isBoundaryInputCall = (callExpression) => {
  if (isIdentifier(callExpression.callee)) {
    return callExpression.callee.name === `readFile` || callExpression.callee.name === `readFileSync`
  }

  if (!isMemberExpression(callExpression.callee)) {
    return false
  }

  const propertyName = getPropertyName(callExpression.callee)
  if (propertyName === null) {
    return false
  }

  if (propertyName === `readFile` || propertyName === `readFileSync`) {
    return true
  }

  if (propertyName !== `json` && propertyName !== `text` && propertyName !== `formData`) {
    return false
  }

  if (!isIdentifier(callExpression.callee.object)) {
    return false
  }

  return (
    callExpression.callee.object.name === `request` ||
    callExpression.callee.object.name === `req` ||
    callExpression.callee.object.name === `response` ||
    callExpression.callee.object.name === `res`
  )
}

/**
 * @param {import('oxlint').ESTree.CallExpression} callExpression
 * @returns {boolean}
 */
const isSchemaDecodeCall = (callExpression) => {
  if (!isMemberExpression(callExpression.callee)) {
    return false
  }

  const propertyName = getPropertyName(callExpression.callee)
  if (propertyName === null || !propertyName.startsWith(`decode`)) {
    return false
  }

  return isIdentifier(callExpression.callee.object) && callExpression.callee.object.name === `Schema`
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isBoundaryModule = (filePath) => {
  if (isTestFilePath(filePath)) {
    return false
  }

  return (
    filePath.includes(`/env/`) ||
    filePath.includes(`/http/`) ||
    filePath.includes(`/file/`) ||
    filePath.includes(`/fs/`) ||
    filePath.includes(`/cli/`) ||
    filePath.includes(`/request/`) ||
    filePath.includes(`/handler/`) ||
    filePath.includes(`/route/`) ||
    filePath.includes(`/server/`)
  )
}

const noJsonParseRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow JSON.parse in Effect-first modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        if (getPropertyName(node.callee) !== `parse`) {
          return
        }

        if (!isJsonObjectReference(node.callee.object)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noJsonParse,
        })
      },
    }
  },
})

const noTryCatchRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow try/catch in favor of typed Effect error channels.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      TryStatement(node) {
        context.report({
          node,
          messageId: MESSAGE_IDS.noTryCatch,
        })
      },
    }
  },
})

const noNativePromiseConstructionRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow native Promise construction in Effect-first modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      NewExpression(node) {
        if (!isPromiseConstructorReference(node.callee)) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noNativePromiseConstruction,
        })
      },
    }
  },
})

const noTypeAssertionRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow TypeScript type assertions in Effect-first modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      TSAsExpression(node) {
        context.report({
          node,
          messageId: MESSAGE_IDS.noTypeAssertion,
        })
      },
      TSTypeAssertion(node) {
        context.report({
          node,
          messageId: MESSAGE_IDS.noTypeAssertion,
        })
      },
    }
  },
})

const noNativeMapSetInEffectModulesRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Map/Set constructors and type annotations in packages/release/src.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (!isReleaseEffectModule(getNormalizedRelativePath(context))) {
      return {}
    }

    return {
      NewExpression(node) {
        if (!isIdentifier(node.callee)) {
          return
        }

        if (node.callee.name !== `Map` && node.callee.name !== `Set`) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noNativeMapSetInEffectModules,
        })
      },
      TSTypeReference(node) {
        const typeName = getTypeName(node.typeName)
        if (typeName !== `Map` && typeName !== `Set`) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noNativeMapSetInEffectModules,
        })
      },
    }
  },
})

const noThrowRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow throw in non-boundary modules.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (isBoundaryAdapterFile(getNormalizedRelativePath(context))) {
      return {}
    }

    return {
      ThrowStatement(node) {
        context.report({
          node,
          messageId: MESSAGE_IDS.noThrow,
        })
      },
    }
  },
})

const noPromiseThenChainRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Promise then/catch/finally chains in favor of Effect composition.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        const propertyName = getPropertyName(node.callee)
        if (propertyName !== `then` && propertyName !== `catch` && propertyName !== `finally`) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noPromiseThenChain,
        })
      },
    }
  },
})

const noEffectRunInLibraryCodeRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Disallow Effect.run* calls outside app/CLI entrypoints and tests.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (isEffectRunAllowedFile(getNormalizedRelativePath(context))) {
      return {}
    }

    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee)) {
          return
        }

        if (!isEffectReference(node.callee.object)) {
          return
        }

        if (!isEffectRunMethodName(getPropertyName(node.callee))) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.noEffectRunInLibraryCode,
        })
      },
    }
  },
})

const requireTypedEffectErrorsRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require explicit, non-any/unknown typed Effect error channels.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    return {
      TSTypeReference(node) {
        if (!isEffectTypeName(node.typeName)) {
          return
        }

        if (node.typeArguments === null || node.typeArguments.params.length < 2) {
          return
        }

        const errorType = node.typeArguments.params[1]
        if (!errorType || !isAnyOrUnknownType(errorType)) {
          return
        }

        context.report({
          node: errorType,
          messageId: MESSAGE_IDS.requireTypedEffectErrors,
        })
      },
    }
  },
})

const requireSchemaDecodeAtBoundaryRule = defineRule({
  meta: {
    type: `problem`,
    docs: {
      description: `Require Effect Schema decode usage in boundary modules reading env/http/file input.`,
      recommended: true,
    },
    messages: MESSAGES,
  },
  create(context) {
    if (!isBoundaryModule(getNormalizedRelativePath(context))) {
      return {}
    }

    let hasBoundaryInputUsage = false
    let hasSchemaDecodeUsage = false

    return {
      MemberExpression(node) {
        if (isProcessEnvMember(node)) {
          hasBoundaryInputUsage = true
        }
      },
      CallExpression(node) {
        if (isBoundaryInputCall(node)) {
          hasBoundaryInputUsage = true
        }

        if (isSchemaDecodeCall(node)) {
          hasSchemaDecodeUsage = true
        }
      },
      'Program:exit'(node) {
        if (!hasBoundaryInputUsage || hasSchemaDecodeUsage) {
          return
        }

        context.report({
          node,
          messageId: MESSAGE_IDS.requireSchemaDecodeAtBoundary,
        })
      },
    }
  },
})

export default definePlugin({
  meta: {
    name: `kitz`,
  },
  rules: {
    'no-json-parse': noJsonParseRule,
    'no-try-catch': noTryCatchRule,
    'no-native-promise-construction': noNativePromiseConstructionRule,
    'no-type-assertion': noTypeAssertionRule,
    'no-native-map-set-in-effect-modules': noNativeMapSetInEffectModulesRule,
    'no-throw': noThrowRule,
    'no-promise-then-chain': noPromiseThenChainRule,
    'no-effect-run-in-library-code': noEffectRunInLibraryCodeRule,
    'require-typed-effect-errors': requireTypedEffectErrorsRule,
    'require-schema-decode-at-boundary': requireSchemaDecodeAtBoundaryRule,
  },
})
