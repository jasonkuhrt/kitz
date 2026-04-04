import { Tui } from '@kitz/tui'
import type { FocusPane, Lifecycle, SelectionMode, UiPackage } from './ui-atoms.js'

// ─── LifecycleTabs ───────────────────────────────────────────────────

const lifecycles: readonly Lifecycle[] = ['official', 'candidate', 'ephemeral']

export function LifecycleTabs({ value }: { readonly value: Lifecycle }) {
  return (
    <box flexDirection="row" height={1} paddingLeft={1}>
      <text content="Lifecycle " fg="#888888" />
      {lifecycles.map((lc) => (
        <Tui.Badge key={lc} label={lc.toUpperCase()} active={lc === value} />
      ))}
    </box>
  )
}

// ─── PackageList ─────────────────────────────────────────────────────

export function PackageList({
  packages,
  selectedPackages,
  cursor,
  selectionMode,
}: {
  readonly packages: readonly UiPackage[]
  readonly selectedPackages: readonly string[]
  readonly cursor: number
  readonly selectionMode: SelectionMode
}) {
  return (
    <scrollbox scrollY={true}>
      {packages.map((pkg, i) => {
        const isCursor = i === cursor
        const isSelected = selectedPackages.includes(pkg.scope)
        const marker = selectionMode === 'all' ? '  ' : isSelected ? '[x]' : '[ ]'
        const cursorChar = isCursor ? '>' : ' '
        const fg = isCursor ? '#00BFFF' : '#CCCCCC'

        return (
          <box key={pkg.scope} flexDirection="row" height={1}>
            <text content={`${cursorChar} ${marker} `} fg={fg} />
            <text content={pkg.scope} fg={fg} />
            <text content={` ${pkg.name}`} fg="#666666" />
          </box>
        )
      })}
    </scrollbox>
  )
}

// ─── Content Panes ───────────────────────────────────────────────────

export function TextPane({ content }: { readonly content: string }) {
  return (
    <scrollbox scrollY={true} flexGrow={1}>
      <text content={content} />
    </scrollbox>
  )
}

export function DiffPane({
  persistedText,
  draftText,
}: {
  readonly persistedText: string | undefined
  readonly draftText: string | undefined
}) {
  if (!draftText) return <text content="No draft to compare." fg="#666666" />

  const oldText = normalizeJson(persistedText ?? '')
  const newText = normalizeJson(draftText)

  if (oldText === newText) {
    return <text content="No changes. Draft matches persisted plan." fg="#666666" />
  }

  const unifiedDiff = createUnifiedDiff(oldText, newText, 'persisted', 'draft')
  return <diff diff={unifiedDiff} view="unified" />
}

function normalizeJson(text: string): string {
  try {
    // eslint-disable-next-line kitz/schema/no-json-parse -- Format normalization, not IO boundary decoding.
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function createUnifiedDiff(
  oldText: string,
  newText: string,
  oldLabel: string,
  newLabel: string,
): string {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: string[] = []
  result.push(`--- ${oldLabel}`)
  result.push(`+++ ${newLabel}`)

  result.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`)
  for (const line of oldLines) {
    result.push(`-${line}`)
  }
  for (const line of newLines) {
    result.push(`+${line}`)
  }

  return result.join('\n')
}

// ─── Key Hints ───────────────────────────────────────────────────────

export const dashboardKeyHints: readonly Tui.KeyHint[] = [
  { key: 'o/c/e', label: 'lifecycle' },
  { key: 'a', label: 'all' },
  { key: 'i', label: 'include' },
  { key: 'x', label: 'exclude' },
  { key: 't', label: 'toggle' },
  { key: 'Tab', label: 'pane' },
  { key: 'j/k', label: 'scroll' },
  { key: 'p', label: 'persist' },
  { key: 'r', label: 'refresh' },
  { key: 'q', label: 'quit' },
]
