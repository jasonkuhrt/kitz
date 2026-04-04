export interface KeyHint {
  readonly key: string
  readonly label: string
}

export interface KeyHintsProps {
  readonly hints: readonly KeyHint[]
}

export function KeyHints({ hints }: KeyHintsProps) {
  return (
    <box flexDirection="row" height={1} width="100%">
      {hints.map((hint, i) => (
        <box key={i} flexDirection="row" paddingRight={2}>
          <text content={hint.key} fg="#00BFFF" />
          <text content={` ${hint.label}`} fg="#888888" />
        </box>
      ))}
    </box>
  )
}
