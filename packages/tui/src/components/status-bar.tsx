export interface StatusBarEntry {
  readonly label: string
  readonly value: string
}

export interface StatusBarProps {
  readonly entries: readonly StatusBarEntry[]
  readonly message?: string
}

export function StatusBar({ entries, message }: StatusBarProps) {
  return (
    <box flexDirection="row" height={1} width="100%">
      {entries.map((entry, i) => (
        <box key={i} flexDirection="row" paddingRight={2}>
          <text content={`${entry.label}: `} fg="#888888" />
          <text content={entry.value} fg="#FFFFFF" />
        </box>
      ))}
      {message && (
        <box flexGrow={1}>
          <text content={message} fg="#FFAA00" />
        </box>
      )}
    </box>
  )
}
