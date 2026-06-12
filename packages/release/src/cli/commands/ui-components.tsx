import { Str } from '@kitz/core'
import { Tui } from '@kitz/tui'
import { Array as A } from 'effect'
import type { FocusPane, Lifecycle, UiPackage } from './ui-atoms.js'

// ─── LifecycleTabs ───────────────────────────────────────────────────

const lifecycles: readonly Lifecycle[] = ['official', 'candidate', 'ephemeral']

export function LifecycleTabs({ value }: { readonly value: Lifecycle }) {
  return (
    <box flexDirection="row" height={1} paddingLeft={1}>
      <text content="Lifecycle " fg="#888888" />
      {A.map(lifecycles, (lc) => (
        <Tui.Badge key={lc} label={lc.toUpperCase()} active={lc === value} />
      ))}
    </box>
  )
}

// ─── PackageList ─────────────────────────────────────────────────────

export function PackageList({
  packages,
  excludedPackages,
  cursor,
}: {
  readonly packages: readonly UiPackage[]
  readonly excludedPackages: readonly string[]
  readonly cursor: number
}) {
  return (
    <scrollbox scrollY={true}>
      {A.map(packages, (pkg, i) => {
        const isCursor = i === cursor
        const isExcluded = A.contains(excludedPackages, pkg.scope)
        const marker = isExcluded ? '[ ]' : '[x]'
        const cursorChar = isCursor ? '>' : ' '
        const fg = isCursor ? '#00BFFF' : isExcluded ? '#666666' : '#CCCCCC'

        return (
          <box key={pkg.scope} flexDirection="row" height={1} overflow="hidden">
            <text content={`${cursorChar} ${marker} `} fg={fg} />
            <text content={pkg.scope} fg={fg} />
            <text content={` ${pkg.name}`} fg="#555555" />
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

export function createUnifiedDiff(
  oldText: string,
  newText: string,
  oldLabel: string,
  newLabel: string,
): string {
  return [
    `--- ${oldLabel}`,
    `+++ ${newLabel}`,
    `@@ -1,${Str.Diff.lines(oldText).length} +1,${Str.Diff.lines(newText).length} @@`,
    ...Str.Diff.toUnifiedLines(Str.Diff.diff(oldText, newText)),
  ].join('\n')
}

// ─── Help Overlay ────────────────────────────────────────────────────

const helpText = `Release UI — Interactive Release Dashboard

CONCEPTS

  Lifecycle    Determines how versions are calculated:
               official — standard semver (feat→minor, fix→patch)
               candidate — pre-release with -next.<N> suffix
               ephemeral — PR-scoped builds (0.0.0-pr.<N>)

  Packages     Every package starts included [x] in the release plan.
               Toggle a package to exclude [ ] it — excluded packages
               won't get releases. The plan, doctor, and diff panes
               update automatically when you change the selection.

  Draft Plan   A preview of what would be released. Computed from
               git history, the chosen lifecycle, and which packages
               are included. Not persisted until you press 'p'.

  Doctor       Checks that run against the draft plan to verify
               the environment is ready for release (npm auth,
               git state, version uniqueness, etc.)

  Persist /    Writes the draft plan to .release/plan.json so that
  Diff         'release apply' can execute it. The diff pane shows
               what would change on disk.

NAVIGATION

  Tab          Cycle focus between panes (Packages→Plan→Doctor→Diff)
  j / k        Move cursor down/up in Packages pane
  Up / Down    Same as j/k

LIFECYCLE

  [            Previous lifecycle (official→ephemeral→candidate→...)
  ]            Next lifecycle (official→candidate→ephemeral→...)

PACKAGES

  t / Enter    Toggle the focused package between included and excluded

ACTIONS

  p            Persist the current draft plan to disk
  r            Refresh workspace data (re-scan git, PR context)
  ?            Toggle this help overlay
  q / Esc      Quit`

export function HelpOverlay() {
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      border={true}
      borderStyle="rounded"
      borderColor="#00BFFF"
      title=" Help (press ? to close) "
      backgroundColor="#1a1a2e"
    >
      <scrollbox scrollY={true} flexGrow={1}>
        <text content={helpText} fg="#CCCCCC" />
      </scrollbox>
    </box>
  )
}

// ─── Key Hints ───────────────────────────────────────────────────────

export const dashboardKeyHints: readonly Tui.KeyHint[] = [
  { key: '[ ]', label: 'lifecycle' },
  { key: 't', label: 'toggle pkg' },
  { key: 'Tab', label: 'pane' },
  { key: 'j/k', label: 'scroll' },
  { key: 'p', label: 'persist' },
  { key: 'r', label: 'refresh' },
  { key: '?', label: 'help' },
  { key: 'q', label: 'quit' },
]
