import { Test } from '@kitz/test'
import { describe, expect, test } from 'vitest'
import {
  type Metadata,
  orderPublishHistory,
  parseMetadata,
  parsePublishHistory,
  type PublishRecord,
  renderMetadataBlock,
} from './metadata.js'

// ── parseMetadata ────────────────────────────────────────────────────

describe('parseMetadata', () => {
  test('returns null for body without plan marker', () => {
    expect(parseMetadata('Just a regular comment')).toBeNull()
  })

  test('extracts head SHA', () => {
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- head-sha:abc1234 -->',
      '<!-- publish-state:idle -->',
    ].join('\n')
    const result = parseMetadata(body)
    expect(result).not.toBeNull()
    expect(result!.headSha).toBe('abc1234')
  })

  test('extracts publish state', () => {
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- head-sha:abc1234 -->',
      '<!-- publish-state:published -->',
    ].join('\n')
    const result = parseMetadata(body)
    expect(result!.publishState).toBe('published')
  })

  test('defaults to idle for unknown state', () => {
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- head-sha:abc1234 -->',
      '<!-- publish-state:unknown-state -->',
    ].join('\n')
    const result = parseMetadata(body)
    expect(result!.publishState).toBe('idle')
  })

  test('extracts publish history', () => {
    const record: PublishRecord = {
      package: '@kitz/core',
      version: '1.0.0',
      iteration: 1,
      sha: 'abc1234',
      timestamp: '2026-01-01T00:00:00Z',
      runId: 'run-123',
    }
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- head-sha:abc1234 -->',
      '<!-- publish-state:published -->',
      '<!-- kitz-release-publish-history',
      JSON.stringify({ publishes: [record] }),
      '-->',
    ].join('\n')
    const result = parseMetadata(body)
    expect(result!.publishHistory).toHaveLength(1)
    expect(result!.publishHistory[0]!.package).toBe('@kitz/core')
  })

  test('handles malformed JSON in history', () => {
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- head-sha:abc1234 -->',
      '<!-- publish-state:idle -->',
      '<!-- kitz-release-publish-history',
      'not valid json',
      '-->',
    ].join('\n')
    const result = parseMetadata(body)
    expect(result!.publishHistory).toHaveLength(0)
  })

  test('handles non-array publishes payload', () => {
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- head-sha:abc1234 -->',
      '<!-- publish-state:idle -->',
      '<!-- kitz-release-publish-history',
      JSON.stringify({ publishes: { invalid: true } }),
      '-->',
    ].join('\n')
    const result = parseMetadata(body)
    expect(result!.publishHistory).toHaveLength(0)
  })

  test('handles missing metadata fields', () => {
    const body = '<!-- kitz-release-plan -->'
    const result = parseMetadata(body)
    expect(result!.headSha).toBe('')
    expect(result!.publishState).toBe('idle')
    expect(result!.publishHistory).toHaveLength(0)
  })
})

// ── parsePublishHistory ──────────────────────────────────────────────

describe('parsePublishHistory', () => {
  test('returns empty for body without marker', () => {
    expect(parsePublishHistory('no marker')).toEqual([])
  })

  test('returns history from valid body', () => {
    const record: PublishRecord = {
      package: '@kitz/core',
      version: '1.0.0',
      iteration: 1,
      sha: 'abc1234',
      timestamp: '2026-01-01T00:00:00Z',
      runId: 'run-123',
    }
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- head-sha:abc1234 -->',
      '<!-- publish-state:published -->',
      '<!-- kitz-release-publish-history',
      JSON.stringify({ publishes: [record] }),
      '-->',
    ].join('\n')
    expect(parsePublishHistory(body)).toHaveLength(1)
  })

  test('returns empty history for malformed payload', () => {
    const body = [
      '<!-- kitz-release-plan -->',
      '<!-- kitz-release-publish-history',
      '{"publishes":',
      '-->',
    ].join('\n')
    expect(parsePublishHistory(body)).toEqual([])
  })
})

describe('orderPublishHistory', () => {
  test('sorts newest publish records first and leaves malformed timestamps last', () => {
    const ordered = orderPublishHistory([
      {
        package: '@kitz/core',
        version: '0.0.0-pr.129.1.gabc1234',
        iteration: 1,
        sha: 'abc1234',
        timestamp: 'not-a-date',
        runId: 'run-1',
      },
      {
        package: '@kitz/core',
        version: '0.0.0-pr.129.2.gdef5678',
        iteration: 2,
        sha: 'def5678',
        timestamp: '2026-03-18T12:00:00.000Z',
        runId: 'run-2',
      },
      {
        package: '@kitz/cli',
        version: '0.0.0-pr.129.2.g9876543',
        iteration: 2,
        sha: '9876543',
        timestamp: '2026-03-18T12:01:00.000Z',
        runId: 'run-3',
      },
    ])

    expect(ordered.map((record) => record.version)).toEqual([
      '0.0.0-pr.129.2.g9876543',
      '0.0.0-pr.129.2.gdef5678',
      '0.0.0-pr.129.1.gabc1234',
    ])
  })
})

// ── renderMetadataBlock → parseMetadata roundtrip ────────────────────

describe('renderMetadataBlock', () => {
  test('roundtrip: render then parse recovers metadata', () => {
    const metadata: Metadata = {
      headSha: 'def5678',
      publishState: 'publishing',
      publishHistory: [
        {
          package: '@kitz/core',
          version: '2.0.0',
          iteration: 3,
          sha: 'ghi9012',
          timestamp: '2026-02-15T12:00:00Z',
          runId: 'run-456',
        },
      ],
    }
    const block = renderMetadataBlock(metadata)
    const parsed = parseMetadata(block)

    expect(parsed).not.toBeNull()
    expect(parsed!.headSha).toBe('def5678')
    expect(parsed!.publishState).toBe('publishing')
    expect(parsed!.publishHistory).toHaveLength(1)
    expect(parsed!.publishHistory[0]!.package).toBe('@kitz/core')
  })

  Test.describe('publish state roundtrip')
    .inputType<Metadata['publishState']>()
    .outputType<Metadata['publishState']>()
    .cases(
      { input: 'idle', output: 'idle' },
      { input: 'publishing', output: 'publishing' },
      { input: 'published', output: 'published' },
      { input: 'failed', output: 'failed' },
    )
    .test(({ input, output }) => {
      const block = renderMetadataBlock({ headSha: 'abc', publishState: input, publishHistory: [] })
      const parsed = parseMetadata(block)
      expect(parsed!.publishState).toBe(output)
    })
})
