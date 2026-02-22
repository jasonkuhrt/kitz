import { Assert } from '@kitz/assert'
import { Test } from '@kitz/test'
import { Effect, Exit, Option, Schema } from 'effect'
import { expect, test } from 'vitest'
import { ConventionalCommits } from './_.js'

// ─── Fixtures ─────────────────────────────────────────────────────

const fixtures = {
  type: {
    standard: {
      feat: ConventionalCommits.Type.Standard.parse('feat'),
      fix: ConventionalCommits.Type.Standard.parse('fix'),
      chore: ConventionalCommits.Type.Standard.parse('chore'),
    },
    custom: {
      wip: ConventionalCommits.Type.Custom.parse('wip'),
    },
  },
  footer: {
    standard: {
      breaking: ConventionalCommits.Footer.from('BREAKING CHANGE', 'removed X'),
      breakingHyphen: ConventionalCommits.Footer.from('BREAKING-CHANGE', 'removed Y'),
    },
    custom: {
      fixes: ConventionalCommits.Footer.from('Fixes', '#123'),
      reviewedBy: ConventionalCommits.Footer.from('Reviewed-by', 'alice'),
    },
  },
  target: {
    featCore: ConventionalCommits.Target.make({
      type: ConventionalCommits.Type.Standard.parse('feat'),
      scope: 'core',
      breaking: false,
    }),
    fixCliBreaking: ConventionalCommits.Target.make({
      type: ConventionalCommits.Type.Standard.parse('fix'),
      scope: 'cli',
      breaking: true,
    }),
  },
  commitSingle: {
    simple: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.Standard.parse('feat'),
      scopes: [],
      breaking: false,
      message: 'add feature',
      body: Option.none(),
      footers: [],
    }),
    withScope: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.Standard.parse('feat'),
      scopes: ['core'],
      breaking: false,
      message: 'add feature',
      body: Option.none(),
      footers: [],
    }),
    multiScope: ConventionalCommits.Commit.Single.make({
      type: ConventionalCommits.Type.Standard.parse('feat'),
      scopes: ['core', 'cli'],
      breaking: true,
      message: 'breaking change',
      body: Option.some('Detailed body'),
      footers: [ConventionalCommits.Footer.from('BREAKING CHANGE', 'removed API')],
    }),
  },
  commitMulti: {
    simple: ConventionalCommits.Commit.Multi.make({
      targets: [
        ConventionalCommits.Target.make({
          type: ConventionalCommits.Type.Standard.parse('feat'),
          scope: 'core',
          breaking: true,
        }),
        ConventionalCommits.Target.make({
          type: ConventionalCommits.Type.Standard.parse('fix'),
          scope: 'cli',
          breaking: false,
        }),
      ],
      message: 'multi change',
      summary: Option.none(),
      sections: {},
    }),
  },
}

// ─── Type Serialization Snapshots ────────────────────────────────

test('Type > Standard > serialization', () => {
  expect(Schema.encodeSync(ConventionalCommits.Type.Standard)(fixtures.type.standard.feat))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Standard",
        "value": "feat",
      }
    `)
  expect(Schema.encodeSync(ConventionalCommits.Type.Standard)(fixtures.type.standard.chore))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Standard",
        "value": "chore",
      }
    `)
})

test('Type > Custom > serialization', () => {
  expect(Schema.encodeSync(ConventionalCommits.Type.Custom)(fixtures.type.custom.wip))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Custom",
        "value": "wip",
      }
    `)
})

// ─── Type.parse() ────────────────────────────────────────────────

Test.describe('Type.parse')
  .on(ConventionalCommits.Type.parse)
  .cases(
    [['feat'], fixtures.type.standard.feat],
    [['fix'], fixtures.type.standard.fix],
    [['chore'], fixtures.type.standard.chore],
    [['wip'], fixtures.type.custom.wip],
  )
  .test()

// ─── Type.impact() ───────────────────────────────────────────────

Test.describe('Type.impact')
  .on(ConventionalCommits.Type.impact)
  .cases(
    [[fixtures.type.standard.feat], Option.some('minor')],
    [[fixtures.type.standard.fix], Option.some('patch')],
    [[fixtures.type.standard.chore], Option.none()],
  )
  .test(({ output, result }) => {
    expect(Option.getOrNull(result)).toEqual(Option.getOrNull(output!))
  })

// ─── Type-level tests for Type.parse() ──────────────────────────

Assert.exact.ofAs<ConventionalCommits.Type.Standard>().on(ConventionalCommits.Type.parse('feat'))
Assert.exact.ofAs<ConventionalCommits.Type.Custom>().on(ConventionalCommits.Type.parse('wip'))
const dynamicType: string = 'unknown'
Assert.exact.ofAs<ConventionalCommits.Type.Type>().on(ConventionalCommits.Type.parse(dynamicType))

// ─── Footer Serialization Snapshots ──────────────────────────────

test('Footer > serialization', () => {
  expect(Schema.encodeSync(ConventionalCommits.Footer.Footer)(fixtures.footer.standard.breaking))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Standard",
        "token": "BREAKING CHANGE",
        "value": "removed X",
      }
    `)
  expect(Schema.encodeSync(ConventionalCommits.Footer.Footer)(fixtures.footer.custom.fixes))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Custom",
        "token": "Fixes",
        "value": "#123",
      }
    `)
})

// ─── Footer.isBreakingChange() ───────────────────────────────────

Test.describe('Footer.isBreakingChange')
  .on(ConventionalCommits.Footer.isBreakingChange)
  .cases(
    [[fixtures.footer.standard.breaking], true],
    [[fixtures.footer.standard.breakingHyphen], true],
    [[fixtures.footer.custom.fixes], false],
  )
  .test()

// ─── Commit.Single Serialization Snapshots ────────────────────────

test('Commit.Single > serialization', () => {
  expect(Schema.encodeSync(ConventionalCommits.Commit.Single)(fixtures.commitSingle.simple))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Single",
        "body": null,
        "breaking": false,
        "footers": [],
        "message": "add feature",
        "scopes": [],
        "type": {
          "_tag": "Standard",
          "value": "feat",
        },
      }
    `)
  expect(Schema.encodeSync(ConventionalCommits.Commit.Single)(fixtures.commitSingle.withScope))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Single",
        "body": null,
        "breaking": false,
        "footers": [],
        "message": "add feature",
        "scopes": [
          "core",
        ],
        "type": {
          "_tag": "Standard",
          "value": "feat",
        },
      }
    `)
  expect(Schema.encodeSync(ConventionalCommits.Commit.Single)(fixtures.commitSingle.multiScope))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Single",
        "body": "Detailed body",
        "breaking": true,
        "footers": [
          {
            "_tag": "Standard",
            "token": "BREAKING CHANGE",
            "value": "removed API",
          },
        ],
        "message": "breaking change",
        "scopes": [
          "core",
          "cli",
        ],
        "type": {
          "_tag": "Standard",
          "value": "feat",
        },
      }
    `)
})

// ─── Commit.Multi Serialization Snapshots ─────────────────────────

test('Commit.Multi > serialization', () => {
  expect(Schema.encodeSync(ConventionalCommits.Commit.Multi)(fixtures.commitMulti.simple))
    .toMatchInlineSnapshot(`
      {
        "_tag": "Multi",
        "message": "multi change",
        "sections": {},
        "summary": null,
        "targets": [
          {
            "_tag": "Target",
            "breaking": true,
            "scope": "core",
            "type": {
              "_tag": "Standard",
              "value": "feat",
            },
          },
          {
            "_tag": "Target",
            "breaking": false,
            "scope": "cli",
            "type": {
              "_tag": "Standard",
              "value": "fix",
            },
          },
        ],
      }
    `)
})

// ─── Commit Union ────────────────────────────────────────────────

const isCommit = Schema.is(ConventionalCommits.Commit.Commit)

Test.describe('Commit > union accepts')
  .on(isCommit)
  .cases(
    [[fixtures.commitSingle.simple], true],
    [[fixtures.commitMulti.simple], true],
  )
  .test()

Test.describe('Commit.Single.is')
  .on(ConventionalCommits.Commit.Single.is)
  .cases(
    [[fixtures.commitSingle.simple], true],
    [[fixtures.commitMulti.simple], false],
  )
  .test()

Test.describe('Commit.Multi.is')
  .on(ConventionalCommits.Commit.Multi.is)
  .cases(
    [[fixtures.commitSingle.simple], false],
    [[fixtures.commitMulti.simple], true],
  )
  .test()

// ─── parseTitle ──────────────────────────────────────────────────

const parseTitleSync = (title: string): ConventionalCommits.Commit.Single | null => {
  const exit = Effect.runSyncExit(ConventionalCommits.Title.parse(title))
  if (Exit.isFailure(exit)) return null
  const value = exit.value
  if (ConventionalCommits.Commit.Single.is(value)) return value
  return null
}

Test.describe('parseTitle > Commit.Single')
  .on(parseTitleSync)
  .cases(
    [['feat: add feature'], fixtures.commitSingle.simple],
    [['feat(core): add feature'], fixtures.commitSingle.withScope],
    [
      ['feat(core, cli): breaking change'],
      ConventionalCommits.Commit.Single.make({
        type: ConventionalCommits.Type.parse('feat'),
        scopes: ['core', 'cli'],
        breaking: false,
        message: 'breaking change',
        body: Option.none(),
        footers: [],
      }),
    ],
    [
      ['feat(core)!: breaking change'],
      ConventionalCommits.Commit.Single.make({
        type: ConventionalCommits.Type.parse('feat'),
        scopes: ['core'],
        breaking: true,
        message: 'breaking change',
        body: Option.none(),
        footers: [],
      }),
    ],
  )
  .test()

Test.describe('parseTitle > errors')
  .on(parseTitleSync)
  .cases(
    [['not a valid commit'], null],
    [['feat:'], null],
  )
  .test()

// ─── parseTitle > Commit.Multi ────────────────────────────────────

test('parseTitle > Commit.Multi', async () => {
  const result = await Effect.runPromiseExit(
    ConventionalCommits.Title.parse('feat(core), fix(cli): multi change'),
  )
  expect(Exit.isSuccess(result)).toBe(true)
  if (Exit.isSuccess(result) && ConventionalCommits.Commit.Multi.is(result.value)) {
    expect(Schema.encodeSync(ConventionalCommits.Commit.Multi)(result.value)).toMatchInlineSnapshot(`
      {
        "_tag": "Multi",
        "message": "multi change",
        "sections": {},
        "summary": null,
        "targets": [
          {
            "_tag": "Target",
            "breaking": false,
            "scope": "core",
            "type": {
              "_tag": "Standard",
              "value": "feat",
            },
          },
          {
            "_tag": "Target",
            "breaking": false,
            "scope": "cli",
            "type": {
              "_tag": "Standard",
              "value": "fix",
            },
          },
        ],
      }
    `)
  }
})

test('parseTitle > Commit.Multi > per-scope breaking', async () => {
  const result = await Effect.runPromiseExit(
    ConventionalCommits.Title.parse('feat(core!), fix(cli): change'),
  )
  expect(Exit.isSuccess(result)).toBe(true)
  if (Exit.isSuccess(result) && ConventionalCommits.Commit.Multi.is(result.value)) {
    expect(result.value.targets[0]?.breaking).toBe(true)
    expect(result.value.targets[1]?.breaking).toBe(false)
  }
})

test('parseTitle > Commit.Multi > global breaking', async () => {
  const result = await Effect.runPromiseExit(
    ConventionalCommits.Title.parse('feat(core), fix(cli)!: change'),
  )
  expect(Exit.isSuccess(result)).toBe(true)
  if (Exit.isSuccess(result) && ConventionalCommits.Commit.Multi.is(result.value)) {
    expect(result.value.targets[0]?.breaking).toBe(true)
    expect(result.value.targets[1]?.breaking).toBe(true)
  }
})

// ─── StandardImpact mapping ──────────────────────────────────────

test('StandardImpact > all standard types have impact mappings', () => {
  for (const key of Object.keys(ConventionalCommits.Type.StandardValue.enums)) {
    expect(ConventionalCommits.Type.StandardImpact[key as ConventionalCommits.Type.StandardValue]).toBeDefined()
  }
})
