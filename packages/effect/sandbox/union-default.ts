/**
 * What identifier does an un-annotated `S.Union([...])` default to?
 *   Run: bun run packages/effect/sandbox/union-default.ts
 */
import { Schema as S, SchemaAST } from 'effect'

// Members with NO identifier of their own (like the path variants before any annotate).
const AbsFile = S.Struct({ _tag: S.Literal('FsPathAbsFile'), name: S.String })
const AbsDir = S.Struct({ _tag: S.Literal('FsPathAbsDir'), name: S.String })

const Bare = S.Union([AbsFile, AbsDir])
const Named = S.Union([AbsFile, AbsDir]).annotate({ identifier: 'Abs' })

const report = (label: string, schema: any) => {
  console.log(`\n=== ${label} ===`)
  console.log('resolveIdentifier(ast):', SchemaAST.resolveIdentifier(schema.ast))
  try {
    S.decodeSync(schema)(42 as any)
  } catch (e) {
    console.log('decode error →', (e as Error).message.split('\n')[0])
  }
}

report('BARE  S.Union([AbsFile, AbsDir])', Bare)
report('NAMED .annotate({ identifier: "Abs" })', Named)
