import { describe, expect, test } from 'bun:test'
import * as OtelModule from './_.js'
import { fromOtlpJson, fromOtlpJsonString, Glyphs, print, printAll, Span, Trace } from './trace.js'

describe('otel', () => {
  test('exports the Otel namespace', () => {
    expect(OtelModule.Otel.Trace).toBe(Trace)
    expect(OtelModule.Otel.Span).toBe(Span)
    expect(OtelModule.Otel.Glyphs).toBe(Glyphs)
    expect(OtelModule.Otel.print).toBe(print)
  })

  test('prints a unicode trace tree by default', () => {
    const trace = Trace.make({
      traceId: 'trace-1',
      spans: [
        Span.make({
          traceId: 'trace-1',
          spanId: 'root',
          name: 'apply',
          serviceName: 'releaseManager',
          startTimeUnixNano: '1000000000',
          endTimeUnixNano: '1120000000',
        }),
        Span.make({
          traceId: 'trace-1',
          spanId: 'pack',
          parentSpanId: 'root',
          name: 'pack',
          serviceName: 'packageManager',
          attributes: { 'release.package.name': '@kitz/core' },
          startTimeUnixNano: '1010000000',
          endTimeUnixNano: '1030000000',
        }),
        Span.make({
          traceId: 'trace-1',
          spanId: 'publish',
          parentSpanId: 'root',
          name: 'publish',
          serviceName: 'packageRegistry',
          attributes: { 'release.package.name': '@kitz/core' },
          startTimeUnixNano: '1040000000',
          endTimeUnixNano: '1110000000',
          statusCode: 'error',
        }),
      ],
    })

    expect(print(trace)).toBe(
      [
        'trace trace-1 (3 spans)',
        '└─ [releaseManager] apply 120ms',
        '   ├─ [packageManager] pack {release.package.name=@kitz/core} 20ms',
        '   └─ [packageRegistry] publish {release.package.name=@kitz/core} 70ms ✗',
      ].join('\n'),
    )
  })

  test('prints with custom downstream glyphs', () => {
    const trace = Trace.make({
      traceId: 'trace-1',
      spans: [
        Span.make({
          traceId: 'trace-1',
          spanId: 'root',
          name: 'apply',
          statusCode: 'ok',
        }),
        Span.make({
          traceId: 'trace-1',
          spanId: 'publish',
          parentSpanId: 'root',
          name: 'publish',
          statusCode: 'error',
        }),
        Span.make({
          traceId: 'trace-1',
          spanId: 'pack',
          parentSpanId: 'root',
          name: 'pack',
          statusCode: 'ok',
        }),
      ],
    })

    const glyphs = Glyphs.make({
      branch: '╞═ ',
      last: '╘═ ',
      vertical: '│  ',
      blank: '   ',
      statusOk: 'pass',
      statusError: 'fail',
    })

    expect(print(trace, { glyphs, showDuration: false })).toBe(
      ['trace trace-1 (3 spans)', '╘═ apply pass', '   ╞═ pack pass', '   ╘═ publish fail'].join(
        '\n',
      ),
    )
  })

  test('keeps orphan spans visible as roots', () => {
    const trace = Trace.make({
      traceId: 'trace-1',
      spans: [
        Span.make({
          traceId: 'trace-1',
          spanId: 'orphan',
          parentSpanId: 'missing',
          name: 'github.release.create',
        }),
        Span.make({
          traceId: 'trace-1',
          spanId: 'root',
          name: 'release.apply',
        }),
      ],
    })

    expect(print(trace, { showTraceId: false, sort: 'input' })).toBe(
      ['trace (2 spans)', '├─ github.release.create', '└─ release.apply'].join('\n'),
    )
  })

  test('parses OTLP JSON and prints multiple traces', () => {
    const traces = fromOtlpJson({
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'release' } }],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: 'a',
                  spanId: 'root',
                  name: 'workflow',
                  startTimeUnixNano: '1000',
                  endTimeUnixNano: '2000',
                  status: { code: 1 },
                },
                {
                  traceId: 'a',
                  spanId: 'child',
                  parentSpanId: 'root',
                  name: 'read',
                  attributes: [{ key: 'fs.path', value: { stringValue: './package.json' } }],
                  startTimeUnixNano: '1200',
                  endTimeUnixNano: '1500',
                },
                {
                  traceId: 'b',
                  spanId: 'root-b',
                  name: 'credentials.resolve',
                  startTimeUnixNano: '3000',
                  endTimeUnixNano: '4000',
                  status: { code: 2 },
                },
              ],
            },
          ],
        },
      ],
    })

    expect(printAll(traces, { showTraceId: true })).toBe(
      [
        'trace a (2 spans)',
        '└─ [release] workflow 1us ✓',
        '   └─ [release] read {fs.path=./package.json} 300ns',
        '',
        'trace b (1 span)',
        '└─ [release] credentials.resolve 1us ✗',
      ].join('\n'),
    )
  })

  test('parses OTLP JSON lines exported by collectors', () => {
    const traces = fromOtlpJsonString(
      [
        JSON.stringify({
          resourceSpans: [
            {
              resource: {
                attributes: [{ key: 'service.name', value: { stringValue: 'git' } }],
              },
              scopeSpans: [{ spans: [{ traceId: 'a', spanId: 'git', name: 'git.push' }] }],
            },
          ],
        }),
        JSON.stringify({
          resourceSpans: [
            {
              resource: {
                attributes: [{ key: 'service.name', value: { stringValue: 'github' } }],
              },
              scopeSpans: [
                {
                  spans: [
                    {
                      traceId: 'a',
                      spanId: 'github',
                      parentSpanId: 'git',
                      name: 'github.release',
                    },
                  ],
                },
              ],
            },
          ],
        }),
      ].join('\n'),
    )

    expect(printAll(traces)).toBe(
      ['trace a (2 spans)', '└─ [git] git.push', '   └─ [github] github.release'].join('\n'),
    )
  })
})
