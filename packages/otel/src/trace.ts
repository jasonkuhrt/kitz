import { Array as A, Option, Record as EffectRecord, Schema as S } from 'effect'

export const SpanStatusCode = S.Literals(['unset', 'ok', 'error'] as const)
export type SpanStatusCode = typeof SpanStatusCode.Type

export const PrintSort = S.Literals(['input', 'name', 'start-time'] as const)
export type PrintSort = typeof PrintSort.Type

export class Glyphs extends S.Class<Glyphs>('OtelGlyphs')({
  branch: S.String,
  last: S.String,
  vertical: S.String,
  blank: S.String,
  statusOk: S.String,
  statusError: S.String,
}) {
  static is = S.is(Glyphs)
  static decode = S.decodeUnknownEffect(Glyphs)
  static decodeSync = S.decodeUnknownSync(Glyphs)
  static encode = S.encodeUnknownEffect(Glyphs)
  static encodeSync = S.encodeUnknownSync(Glyphs)
  static equivalence = S.toEquivalence(Glyphs)
  static ordered = false as const

  static unicode = Glyphs.make({
    branch: '├─ ',
    last: '└─ ',
    vertical: '│  ',
    blank: '   ',
    statusOk: '✓',
    statusError: '✗',
  })

  static status = (glyphs: Glyphs, status: Exclude<SpanStatusCode, 'unset'>) =>
    status === 'ok' ? glyphs.statusOk : glyphs.statusError
}

export class PrintOptions extends S.Class<PrintOptions>('OtelPrintOptions')({
  glyphs: S.optional(Glyphs),
  showDuration: S.optional(S.Boolean),
  showService: S.optional(S.Boolean),
  showSpanIds: S.optional(S.Boolean),
  showStatus: S.optional(S.Boolean),
  showTraceId: S.optional(S.Boolean),
  sort: S.optional(PrintSort),
}) {
  static is = S.is(PrintOptions)
  static decode = S.decodeUnknownEffect(PrintOptions)
  static decodeSync = S.decodeUnknownSync(PrintOptions)
  static encode = S.encodeUnknownEffect(PrintOptions)
  static encodeSync = S.encodeUnknownSync(PrintOptions)
  static equivalence = S.toEquivalence(PrintOptions)
  static ordered = false as const
}

export type PrintOptionsInput = typeof PrintOptions.Encoded

export class Span extends S.Class<Span>('OtelSpan')({
  traceId: S.String,
  spanId: S.String,
  parentSpanId: S.optional(S.String),
  name: S.String,
  serviceName: S.optional(S.String),
  startTimeUnixNano: S.optional(S.String),
  endTimeUnixNano: S.optional(S.String),
  statusCode: S.optional(SpanStatusCode),
}) {
  static is = S.is(Span)
  static decode = S.decodeUnknownEffect(Span)
  static decodeSync = S.decodeUnknownSync(Span)
  static encode = S.encodeUnknownEffect(Span)
  static encodeSync = S.encodeUnknownSync(Span)
  static equivalence = S.toEquivalence(Span)
  static ordered = false as const

  get durationUnixNano() {
    return durationUnixNano(this)
  }
}

export class Trace extends S.Class<Trace>('OtelTrace')({
  traceId: S.String,
  spans: S.Array(Span),
}) {
  static is = S.is(Trace)
  static decode = S.decodeUnknownEffect(Trace)
  static decodeSync = S.decodeUnknownSync(Trace)
  static encode = S.encodeUnknownEffect(Trace)
  static encodeSync = S.encodeUnknownSync(Trace)
  static equivalence = S.toEquivalence(Trace)
  static ordered = false as const

  static print(trace: Trace, options?: PrintOptionsInput) {
    return print(trace, options)
  }

  override toString() {
    return print(this)
  }
}

type UnknownRecord = Readonly<Record<string, unknown>>
type Ordering = -1 | 0 | 1

interface ResolvedPrintOptions {
  readonly showDuration: boolean
  readonly showService: boolean
  readonly showSpanIds: boolean
  readonly showStatus: boolean
  readonly showTraceId: boolean
  readonly sort: PrintSort
  readonly glyphs: Glyphs
}

interface SpanNode {
  readonly span: Span
  readonly children: readonly SpanNode[]
}

const defaultPrintOptions = {
  glyphs: Glyphs.unicode,
  showDuration: true,
  showService: true,
  showSpanIds: false,
  showStatus: true,
  showTraceId: true,
  sort: 'start-time',
} as const satisfies ResolvedPrintOptions

const resolvePrintOptions = (options: PrintOptionsInput | undefined): ResolvedPrintOptions => ({
  glyphs:
    options?.glyphs === undefined ? defaultPrintOptions.glyphs : Glyphs.decodeSync(options.glyphs),
  showDuration: options?.showDuration ?? defaultPrintOptions.showDuration,
  showService: options?.showService ?? defaultPrintOptions.showService,
  showSpanIds: options?.showSpanIds ?? defaultPrintOptions.showSpanIds,
  showStatus: options?.showStatus ?? defaultPrintOptions.showStatus,
  showTraceId: options?.showTraceId ?? defaultPrintOptions.showTraceId,
  sort: options?.sort ?? defaultPrintOptions.sort,
})

const UnknownJson = S.fromJsonString(S.Unknown)
const parseJson = S.decodeUnknownSync(UnknownJson)

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const asRecord = (value: unknown): UnknownRecord | undefined =>
  isRecord(value) ? value : undefined

const get = (value: unknown, key: string): unknown => asRecord(value)?.[key]

const arrayFrom = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const stringFrom = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return `${value}`
  return undefined
}

const nonEmptyStringFrom = (value: unknown): string | undefined => {
  const string = stringFrom(value)
  return string === undefined || string === '' ? undefined : string
}

const attributeValue = (value: unknown): string | undefined => {
  const record = asRecord(value)
  if (record === undefined) return undefined

  return (
    stringFrom(record['stringValue']) ??
    stringFrom(record['intValue']) ??
    stringFrom(record['doubleValue']) ??
    stringFrom(record['boolValue'])
  )
}

const attributesRecord = (attributes: unknown) =>
  A.reduce(arrayFrom(attributes), EffectRecord.empty<string, string>(), (record, attribute) => {
    const key = stringFrom(get(attribute, 'key'))
    const value = attributeValue(get(attribute, 'value'))

    return key === undefined || value === undefined ? record : EffectRecord.set(record, key, value)
  })

const statusCodeFrom = (status: unknown): SpanStatusCode | undefined => {
  const code = get(status, 'code')

  if (code === 1 || code === '1' || code === 'STATUS_CODE_OK' || code === 'ok') return 'ok'
  if (code === 2 || code === '2' || code === 'STATUS_CODE_ERROR' || code === 'error') return 'error'

  return undefined
}

const spanFromOtlp = (span: unknown, serviceName: string | undefined): Span | undefined => {
  const traceId = nonEmptyStringFrom(get(span, 'traceId'))
  const spanId = nonEmptyStringFrom(get(span, 'spanId'))
  const name = nonEmptyStringFrom(get(span, 'name'))

  if (traceId === undefined || spanId === undefined || name === undefined) return undefined

  const parentSpanId = nonEmptyStringFrom(get(span, 'parentSpanId'))
  const startTimeUnixNano = nonEmptyStringFrom(get(span, 'startTimeUnixNano'))
  const endTimeUnixNano = nonEmptyStringFrom(get(span, 'endTimeUnixNano'))
  const statusCode = statusCodeFrom(get(span, 'status'))

  return Span.make({
    traceId,
    spanId,
    name,
    ...(parentSpanId === undefined ? {} : { parentSpanId }),
    ...(serviceName === undefined ? {} : { serviceName }),
    ...(startTimeUnixNano === undefined ? {} : { startTimeUnixNano }),
    ...(endTimeUnixNano === undefined ? {} : { endTimeUnixNano }),
    ...(statusCode === undefined ? {} : { statusCode }),
  })
}

const spansFromResourceSpans = (resourceSpans: unknown): readonly Span[] => {
  const resourceAttributes = attributesRecord(get(get(resourceSpans, 'resource'), 'attributes'))
  const serviceName = Option.getOrUndefined(EffectRecord.get(resourceAttributes, 'service.name'))

  return A.flatMap(arrayFrom(get(resourceSpans, 'scopeSpans')), (scopeSpans) =>
    A.flatMap(arrayFrom(get(scopeSpans, 'spans')), (span) => {
      const parsed = spanFromOtlp(span, serviceName)
      return parsed === undefined ? [] : [parsed]
    }),
  )
}

const tracesFromSpans = (spans: readonly Span[]): readonly Trace[] => {
  const spansByTrace = A.reduce(
    spans,
    EffectRecord.empty<string, readonly Span[]>(),
    (record, span) => {
      const current = Option.getOrElse(EffectRecord.get(record, span.traceId), () => [])
      return EffectRecord.set(record, span.traceId, A.append(current, span))
    },
  )

  return A.map(EffectRecord.toEntries(spansByTrace), ([traceId, traceSpans]) =>
    Trace.make({
      traceId,
      spans: [...traceSpans],
    }),
  )
}

const nanoFrom = (value: string | undefined): bigint | undefined => {
  if (value === undefined) return undefined

  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

const durationUnixNano = (span: Span): bigint | undefined => {
  const start = nanoFrom(span.startTimeUnixNano)
  const end = nanoFrom(span.endTimeUnixNano)

  return start === undefined || end === undefined || end < start ? undefined : end - start
}

const formatDecimal = (value: bigint, unitSize: bigint, unit: string): string => {
  const whole = value / unitSize
  const decimal = ((value % unitSize) * 10n) / unitSize

  return decimal === 0n ? `${whole}${unit}` : `${whole}.${decimal}${unit}`
}

const formatDuration = (nanos: bigint): string => {
  if (nanos < 1_000n) return `${nanos}ns`
  if (nanos < 1_000_000n) return formatDecimal(nanos, 1_000n, 'us')
  if (nanos < 1_000_000_000n) return formatDecimal(nanos, 1_000_000n, 'ms')
  return formatDecimal(nanos, 1_000_000_000n, 's')
}

const compareString = (a: string, b: string): Ordering => {
  const order = a.localeCompare(b)

  if (order < 0) return -1
  if (order > 0) return 1
  return 0
}

const compareNano = (a: string | undefined, b: string | undefined): Ordering => {
  const left = nanoFrom(a)
  const right = nanoFrom(b)

  if (left === undefined && right === undefined) return 0
  if (left === undefined) return 1
  if (right === undefined) return -1
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const compareSpan =
  (options: ResolvedPrintOptions) =>
  (left: Span, right: Span): Ordering => {
    if (options.sort === 'input') return 0

    const primary =
      options.sort === 'name'
        ? compareString(left.name, right.name)
        : compareNano(left.startTimeUnixNano, right.startTimeUnixNano)

    if (primary !== 0) return primary

    const nameOrder = compareString(left.name, right.name)
    if (nameOrder !== 0) return nameOrder

    return compareString(left.spanId, right.spanId)
  }

const sortSpans = (spans: readonly Span[], options: ResolvedPrintOptions): readonly Span[] =>
  options.sort === 'input' ? spans : A.sort(spans, compareSpan(options))

const childrenByParent = (trace: Trace) =>
  A.reduce(trace.spans, EffectRecord.empty<string, readonly Span[]>(), (record, span) => {
    if (span.parentSpanId === undefined) return record

    const current = Option.getOrElse(EffectRecord.get(record, span.parentSpanId), () => [])
    return EffectRecord.set(record, span.parentSpanId, A.append(current, span))
  })

const spanIds = (trace: Trace) =>
  A.reduce(trace.spans, EffectRecord.empty<string, true>(), (record, span) =>
    EffectRecord.set(record, span.spanId, true),
  )

const nodesFor = (trace: Trace, options: ResolvedPrintOptions): readonly SpanNode[] => {
  const children = childrenByParent(trace)
  const ids = spanIds(trace)
  const buildNode = (span: Span): SpanNode => ({
    span,
    children: A.map(
      sortSpans(
        Option.getOrElse(EffectRecord.get(children, span.spanId), () => []),
        options,
      ),
      buildNode,
    ),
  })

  const roots = A.filter(
    trace.spans,
    (span) => span.parentSpanId === undefined || !EffectRecord.has(ids, span.parentSpanId),
  )

  return A.map(sortSpans(roots, options), buildNode)
}

const spanLabel = (span: Span, options: ResolvedPrintOptions): string => {
  const parts = [span.name]
  const duration = span.durationUnixNano

  if (options.showService && span.serviceName !== undefined) parts.push(`[${span.serviceName}]`)
  if (options.showDuration && duration !== undefined) parts.push(formatDuration(duration))
  if (options.showStatus && span.statusCode !== undefined && span.statusCode !== 'unset') {
    parts.push(Glyphs.status(options.glyphs, span.statusCode))
  }
  if (options.showSpanIds) parts.push(`#${span.spanId}`)

  return parts.join(' ')
}

const renderNode = (
  node: SpanNode,
  options: ResolvedPrintOptions,
  prefix: string,
  last: boolean,
): readonly string[] => {
  const connector = last ? options.glyphs.last : options.glyphs.branch
  const nextPrefix = `${prefix}${last ? options.glyphs.blank : options.glyphs.vertical}`
  const current = `${prefix}${connector}${spanLabel(node.span, options)}`

  return [
    current,
    ...A.flatMap(node.children, (child, index) =>
      renderNode(child, options, nextPrefix, index === node.children.length - 1),
    ),
  ]
}

export const print = (trace: Trace, options?: PrintOptionsInput): string => {
  const resolved = resolvePrintOptions(options)
  const traceLabel = resolved.showTraceId ? `trace ${trace.traceId}` : 'trace'
  const header = `${traceLabel} (${trace.spans.length} ${trace.spans.length === 1 ? 'span' : 'spans'})`
  const nodes = nodesFor(trace, resolved)
  const lines = [
    header,
    ...A.flatMap(nodes, (node, index) =>
      renderNode(node, resolved, '', index === nodes.length - 1),
    ),
  ]

  return lines.join('\n')
}

export const printAll = (traces: readonly Trace[], options?: PrintOptionsInput): string =>
  A.map(traces, (trace) => print(trace, options)).join('\n\n')

const spansFromOtlpJson = (value: unknown): readonly Span[] =>
  Array.isArray(value)
    ? A.flatMap(value, spansFromOtlpJson)
    : A.flatMap(arrayFrom(get(value, 'resourceSpans')), spansFromResourceSpans)

export const fromOtlpJson = (value: unknown): readonly Trace[] =>
  tracesFromSpans(spansFromOtlpJson(value))

export const fromOtlpJsonString = (content: string): readonly Trace[] => {
  const trimmed = content.trim()
  if (trimmed === '') return []

  try {
    return fromOtlpJson(parseJson(trimmed))
  } catch {
    return tracesFromSpans(
      A.flatMap(
        A.filter(trimmed.split(/\r?\n/), (line) => line.trim() !== ''),
        (line) => spansFromOtlpJson(parseJson(line)),
      ),
    )
  }
}
