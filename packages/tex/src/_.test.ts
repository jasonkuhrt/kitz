import * as ansis from 'ansis'
import { Schema as S } from 'effect'
import { describe, expect, test } from 'vitest'
import * as TexNamespace from './_.js'
import * as Tex from './__.js'
import * as Clockhand from './box/clockhand/clockhand.js'
import { getTerminalWidth } from './env.js'

describe('tex', () => {
  test('re-exports the public rendering surface and glyph libraries', () => {
    expect(TexNamespace.Tex.Tex).toBe(Tex.Tex)
    expect(TexNamespace.Tex.render).toBe(Tex.render)
    expect(Tex.Glyph.arrow.right).toBe(`\u2192`)
    expect(Tex.Glyph.arrow.leftDouble).toBe(`\u21D0`)
    expect(Tex.Glyph.status.check).toBe(`\u2713`)
    expect(Tex.Glyph.status.warning).toBe(`\u26A0`)
  })

  test('reads terminal width from env and stdout with fallback behavior', () => {
    const originalColumns = process.env.COLUMNS
    const originalDescriptor = Object.getOwnPropertyDescriptor(process.stdout, `columns`)

    try {
      process.env.COLUMNS = `72`
      expect(getTerminalWidth(10)).toBe(72)

      process.env.COLUMNS = `nope`
      Object.defineProperty(process.stdout, `columns`, {
        value: 44,
        configurable: true,
      })
      expect(getTerminalWidth(10)).toBe(44)

      Object.defineProperty(process.stdout, `columns`, {
        value: undefined,
        configurable: true,
      })
      expect(getTerminalWidth(33)).toBe(33)
    } finally {
      if (originalColumns === undefined) {
        delete process.env.COLUMNS
      } else {
        process.env.COLUMNS = originalColumns
      }

      if (originalDescriptor) {
        Object.defineProperty(process.stdout, `columns`, originalDescriptor)
      } else {
        delete (process.stdout as { columns?: number }).columns
      }
    }
  })

  test('parses box property shorthands and one-way schemas', () => {
    expect(Clockhand.parse(`*`)).toEqual({
      top: `*`,
      right: `*`,
      bottom: `*`,
      left: `*`,
    })
    expect(Clockhand.parse([1, 2])).toEqual({
      top: 1,
      right: 2,
      bottom: 1,
      left: 2,
    })
    expect(Clockhand.parse([1, 2, 3])).toEqual({
      top: 1,
      right: 2,
      bottom: 3,
      left: 2,
    })
    expect(Clockhand.parse([1, undefined, 3, 4])).toEqual({
      top: 1,
      right: undefined,
      bottom: 3,
      left: 4,
    })
    expect(Clockhand.parse({ left: `L` })).toEqual({ left: `L` })
    expect(() => Clockhand.parse([1, 2, 3, 4, 5] as any)).toThrow(
      `Invalid clockhand array length: 5`,
    )

    expect(Tex.Box.Sided.parse(2)).toEqual({
      mainStart: 2,
      mainEnd: 2,
      crossStart: 2,
      crossEnd: 2,
    })
    expect(Tex.Box.Sided.parse([2, 4])).toEqual({
      mainStart: 2,
      mainEnd: 2,
      crossStart: 4,
      crossEnd: 4,
    })
    expect(
      Tex.Box.Sided.parse([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual({
      mainStart: 1,
      mainEnd: 2,
      crossStart: 3,
      crossEnd: 4,
    })
    expect(Tex.Box.Sided.parse({ main: [1, 2], cross: { end: 5 } })).toEqual({
      mainStart: 1,
      mainEnd: 2,
      crossEnd: 5,
    })

    expect(Tex.Box.Axied.parse(3)).toEqual({ main: 3, cross: 3 })
    expect(Tex.Box.Axied.parse([3])).toEqual({ main: 3 })
    expect(Tex.Box.Axied.parse([undefined, 5])).toEqual({ cross: 5 })
    expect(Tex.Box.Axied.parse({ main: 8 })).toEqual({ main: 8 })

    expect(
      Tex.Box.Padding.parse([
        [1, 2],
        [3, 4],
      ]),
    ).toMatchObject({
      mainStart: 1,
      mainEnd: 2,
      crossStart: 3,
      crossEnd: 4,
    })
    expect(Tex.Box.Margin.parse({ mainStart: `..`, crossEnd: 25n })).toMatchObject({
      mainStart: `..`,
      crossEnd: 25n,
    })
    expect(Tex.Box.Padding.resolveValue(`>>`, 20)).toBe(2)
    expect(Tex.Box.Padding.resolveValue(25n, 20)).toBe(5)
    expect(Tex.Box.Margin.resolveValue(`>>`, 20)).toBe(2)
    expect(Tex.Box.Margin.resolveValue(25n, 20)).toBe(5)

    expect(Tex.Box.Border.styles.single.edges?.top).toBe(`─`)
    expect(Tex.Box.Border.cornerStyles.ascii.bottomLeft).toBe(`+`)
    expect(S.decodeSync(Tex.Box.Border.fromCornerInput)(`rounded`)).toMatchObject({
      topLeft: `╭`,
      topRight: `╮`,
      bottomRight: `╯`,
      bottomLeft: `╰`,
    })
    expect(S.decodeSync(Tex.Box.Border.fromCornerInput)([`a`, `b`, `c`, `d`])).toMatchObject({
      topLeft: `a`,
      topRight: `b`,
      bottomRight: `c`,
      bottomLeft: `d`,
    })
    expect(
      S.decodeSync(Tex.Box.Border.fromCornerInput)({
        topLeft: `x`,
        bottomRight: `y`,
      }),
    ).toMatchObject({
      topLeft: `x`,
      bottomRight: `y`,
    })

    expect(() =>
      S.encodeSync(Tex.Box.Border.fromCornerInput)(
        Tex.Box.Border.BorderCorners.make({ topLeft: `x` }),
      ),
    ).toThrow(`One-way transformation`)
    expect(() =>
      S.encodeSync(Tex.Box.Padding.fromInput)(Tex.Box.Padding.Padding.make({ mainStart: 1 })),
    ).toThrow(`One-way transformation`)
    expect(() =>
      S.encodeSync(Tex.Box.Margin.fromInput)(Tex.Box.Margin.Margin.make({ mainStart: 1 })),
    ).toThrow(`One-way transformation`)
    expect(() =>
      S.encodeSync(Tex.Box.Sided.fromInput(Tex.Box.Padding.Value))({ mainStart: 1 } as any),
    ).toThrow(`One-way transformation`)
    expect(() =>
      S.encodeSync(Tex.Box.Axied.fromInput(Tex.Box.Span.ValueSchema))({ main: 1 } as any),
    ).toThrow(`One-way transformation`)
  })

  test('renders nested blocks, standalone blocks, lists, and tables', () => {
    const standalone = Tex.block({ border: { style: `single` }, padding: [0, 1] }, [
      `A`,
      null,
      Tex.block(($) => $.text(`B`)),
    ])

    expect(standalone).toBeInstanceOf(Tex.Block)

    const builder = Tex.Tex({ terminalWidth: 28, padding: [0, 1], border: { style: `single` } })
      .text(`Header`)
      .block(standalone)
      .list(
        {
          gap: 1,
          bullet: {
            graphic: (index) => `${index + 1}.`,
            align: { horizontal: `right` },
          },
        },
        ($) => $.item(`First`).items(`Second`, null).items([`Third`]),
      )
      .table({ gap: { main: `-`, cross: ` | `, intersection: `-+-` } }, ($) =>
        $.headers([`Name`])
          .header({ border: { style: `single` } }, `Count`)
          .row(`Apples`, `2`)
          .rows([[`Pears`, `10`], null, [`Oranges`, `100`]]),
      )
      .block({ border: { style: `single` }, padding: [0, 1] }, ($) =>
        $.text(`Inner`).list([`Nested`, `Items`]),
      )

    const output = builder.render()

    expect(Tex.render(builder)).toBe(output)
    expect(output).toContain(`Header`)
    expect(output).toContain(`1. First`)
    expect(output).toContain(`Name`)
    expect(output).toContain(`Count`)
    expect(output).toContain(`Oranges`)
    expect(output).toContain(`Inner`)
    expect(output).toContain(`Nested`)
  })

  test('supports mutable and immutable box operations with ansi styling helpers', () => {
    expect(Tex.Box.getWidth(undefined)).toBe(0)
    expect(Tex.Box.getWidth(3)).toBe(3)
    expect(Tex.Box.getWidth(`wide`)).toBe(4)
    expect(Tex.Box.getWidth(50n)).toBe(0)

    const ansiChain = Tex.Box.Ansi.buildAnsiChain({
      bold: true,
      underline: true,
      color: {
        foreground: `red`,
        background: `#0000ff`,
      },
    })

    expect(Tex.Box.Ansi.isAnsiStyle(ansiChain)).toBe(true)
    expect(Tex.Box.Ansi.isAnsiStyle(ansis.red)).toBe(true)
    expect(typeof ansiChain.open).toBe(`string`)
    expect(typeof ansiChain.close).toBe(`string`)
    expect(Tex.Box.Ansi.applyStyle(`X`, { bold: true, color: { foreground: `red` } })).toBeTypeOf(
      `string`,
    )
    expect(Tex.Box.Ansi.extractChar({ char: `#`, bold: true })).toBe(`#`)
    expect(
      Tex.Box.Ansi.extractStyle({
        char: `#`,
        bold: true,
        color: { foreground: `red` },
      }),
    ).toMatchObject({
      bold: true,
      color: { foreground: `red` },
    })

    const base = Tex.Box.Box.make({ content: `seed` })
    const immutable = Tex.Box.border(
      Tex.Box.gap(
        Tex.Box.spanRange(
          Tex.Box.span(
            Tex.Box.margin(Tex.Box.pad(Tex.Box.content(base, `updated`), [1, 2]), [1, 1]),
            {
              cross: 22,
            },
          ),
          { cross: { min: 8, max: 30 } },
        ),
        { main: 1, cross: 2 },
      ),
      {
        style: `single`,
      },
    )

    expect(base.toString()).toBe(`seed`)
    expect(immutable.toString()).toContain(`updated`)
    expect(
      Tex.Box.makeFromEncoded({
        content: `encoded`,
        padding: { mainStart: 1, mainEnd: 1, crossStart: 2, crossEnd: 2 },
      }).toString(),
    ).toContain(`encoded`)
    const fromInputBox = Tex.Box.makeFromInput({
      content: `input`,
      padding: [1, 2],
      margin: { mainStart: 1 },
      span: [2, 20],
      gap: 1,
      border: { corners: `rounded` },
    })
    expect(fromInputBox).toBeInstanceOf(Tex.Box.Box)
    expect(fromInputBox.content).toBe(`input`)
    expect(fromInputBox.padding).toMatchObject({
      mainStart: 1,
      mainEnd: 1,
      crossStart: 2,
      crossEnd: 2,
    })
    expect(fromInputBox.border?.corners).toMatchObject({
      topLeft: `╭`,
      topRight: `╮`,
      bottomRight: `╯`,
      bottomLeft: `╰`,
    })
    expect(S.decodeSync(Tex.Box.String)(base)).toBe(`seed`)
    expect(() => S.encodeSync(Tex.Box.String)(`seed`)).toThrow()

    const mutable = Tex.Box.Box.make({
      content: [
        `Header`,
        { text: `Body`, color: { foreground: `green` }, bold: true },
        Tex.Box.Box.make({ content: `Inner` }).pad$([0, 1]).border$({ style: `single` }),
      ],
    })
      .gap$({ main: 1, cross: 1 })
      .pad$({
        mainStart: ({ lineIndex }) => lineIndex + 1,
        crossStart: 1,
        crossEnd: 1,
      })
      .margin$({
        mainEnd: 1,
        crossStart: 1,
      })
      .border$({
        style: `single`,
        edges: {
          top: { char: `=`, color: { foreground: `blue` } },
          left: ({ lineIndex }) => (lineIndex === 0 ? `>` : `|`),
        },
        corners: {
          topLeft: { char: `*`, bold: true },
          bottomRight: `+`,
        },
      })
      .span$({ cross: 30 })
      .spanRange$({ cross: { min: 10, max: 40 } })

    const rendered = Tex.Box.render(mutable)

    expect(rendered).toContain(`Header`)
    expect(rendered).toContain(`Body`)
    expect(rendered).toContain(`Inner`)
    expect(rendered).toContain(`*`)
    expect(rendered).toContain(`=`)
    expect(Tex.Box.encode(mutable)).toBe(rendered)
  })
})
