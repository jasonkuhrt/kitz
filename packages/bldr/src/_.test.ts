import { describe, expect, test } from 'vitest'
import * as BldrModule from './_.js'
import { createCallable, createCallableMutable, fromInterface } from './callable.js'
import { StateSymbol, create } from './constructor.js'
import { createMutable } from './mutable.js'

describe('bldr', () => {
  test('exports the namespace and immutable builder constructor', () => {
    const builder = create({
      initial: { items: [] as string[], count: 0 },
      methods: {
        add: (state, item: string) => ({ ...state, items: [...state.items, item] }),
        keep: () => undefined,
      },
      terminal: {
        build: (state) => state.items.join(','),
        snapshot: (state) => state,
      },
    })

    const next = builder.add('a')

    expect(BldrModule.Bldr.create).toBe(create)
    expect(BldrModule.Bldr.createCallable).toBe(createCallable)
    expect(builder[StateSymbol]).toEqual({ items: [], count: 0 })
    expect(next[StateSymbol]).toEqual({ items: ['a'], count: 0 })
    expect(builder.keep().build()).toBe('')
    expect(next.add('b').build()).toBe('a,b')
    expect(next.snapshot()).toEqual({ items: ['a'], count: 0 })
  })

  test('supports mutable builders with auto-chaining and terminal returns', () => {
    const builder = createMutable({
      data: { lines: [] as string[], calls: 0 },
      builder: {
        add: (line: string) => {
          builder.data.lines.push(line)
        },
        size: () => builder.data.lines.length,
      },
    })

    const chained = builder.add('first').add('second')

    expect(chained).toBe(builder)
    expect(builder.size()).toBe(2)
    expect(builder.return()).toEqual({ lines: ['first', 'second'], calls: 0 })
  })

  test('creates immutable callable builders in direct and curried forms', () => {
    const builder = createCallable({
      initial: { lines: [] as string[] },
      call: (state, line: string) => ({ ...state, lines: [...state.lines, line] }),
      methods: {
        comment: (state, label: string) => ({
          ...state,
          lines: [...state.lines, `// ${label}`],
        }),
        noop: () => undefined,
      },
      terminal: {
        build: (state) => state.lines.join('\n'),
        snapshot: (state) => state,
      },
    })

    const result = builder('const a = 1').comment(
      'note',
    )`value ${123} ${true} ${Symbol('s')} ${null} ${undefined} ${{ ok: 1 }}`
      .noop()
      .build()

    const curried = createCallable<{ items: string[] }>()({
      initial: { items: [] },
      call: (state, item: string) => ({ ...state, items: [...state.items, item] }),
      templateTag: (state, strings, ...values) => ({
        ...state,
        items: [...state.items, strings[0] + values.join('|') + strings[1]],
      }),
      methods: {
        upper: (state) => ({ ...state, items: state.items.map((item) => item.toUpperCase()) }),
      },
      terminal: {
        items: (state) => state.items,
      },
    })

    expect(result).toContain('const a = 1')
    expect(result).toContain('// note')
    expect(result).toContain('value 123 true Symbol(s)   {"ok":1}')
    expect(builder.snapshot().lines).toEqual([])
    expect(builder('next')[StateSymbol]).toEqual({ lines: ['next'] })
    expect(curried('hello').upper()`tag ${'value'}`.items()).toEqual(['HELLO', 'tag value'])
  })

  test('creates mutable callable builders with shared data and terminal methods', () => {
    const builder = createCallableMutable({ lines: [] as string[], count: 0 }, (data) => ({
      call: (line: string) => {
        data.count += 1
        data.lines.push(line)
      },
      builder: {
        comment: (label: string) => {
          data.lines.push(`// ${label}`)
        },
        count: () => data.count,
      },
      terminal: {
        build: () => data.lines.join('\n'),
      },
    }))

    const curried = createCallableMutable<{ lines: string[]; tags: string[] }>()(
      { lines: [], tags: [] },
      (data) => ({
        call: (line: string) => {
          data.lines.push(line)
        },
        templateTag: (strings, ...values) => {
          data.tags.push(strings[0] + values.join('|') + strings[1])
        },
        builder: {
          line: (value: string) => {
            data.lines.push(value)
          },
        },
        terminal: {
          snapshot: () => data,
        },
      }),
    )

    expect(builder('one').comment('two').build()).toBe('one\n// two')
    expect(builder.count()).toBe(1)
    expect(builder.data).toEqual({ lines: ['one', '// two'], count: 1 })
    expect(curried('alpha').line('beta')`tag ${'gamma'}`.snapshot()).toEqual({
      lines: ['alpha', 'beta'],
      tags: ['tag gamma'],
    })
  })

  test('creates fresh interface-driven callable builders', () => {
    interface CodeBuilder {
      (line: string): CodeBuilder
      (strings: TemplateStringsArray, ...values: unknown[]): CodeBuilder
      comment(label: string): CodeBuilder
      build(): string
    }

    const factory = fromInterface<CodeBuilder>()({ lines: [] as string[] }, (data) => ({
      call: (line) => {
        data.lines.push(line)
      },
      comment: (label) => {
        data.lines.push(`// ${label}`)
      },
      build: () => data.lines.join('\n'),
    }))

    const first = factory()
    const second = factory()

    expect(first('a').comment('b')`value ${1} ${false}`.build()).toBe('a\n// b\nvalue 1 false')
    expect(second.build()).toBe('')
  })
})
