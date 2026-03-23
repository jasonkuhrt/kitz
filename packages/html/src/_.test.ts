import { describe, expect, test } from 'vitest'
import * as HtmlModule from './_.js'
import { escape } from './html.js'

describe('html', () => {
  test('exports the Html namespace', () => {
    expect(HtmlModule.Html.escape).toBe(escape)
  })

  test('escapes HTML special characters', () => {
    expect(escape(`<script>alert("xss") & 'oops'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;) &amp; &#39;oops&#39;&lt;/script&gt;',
    )
    expect(escape('fish & chips')).toBe('fish &amp; chips')
  })

  test('preserves safe strings and coerces other values', () => {
    expect(escape('plain text')).toBe('plain text')
    expect(escape(42)).toBe('42')
  })
})
