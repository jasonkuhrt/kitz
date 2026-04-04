import type { ReactNode } from 'react'

export interface PanelProps {
  readonly title: string
  readonly active?: boolean
  readonly width?: number | 'auto' | `${number}%`
  readonly height?: number | 'auto' | `${number}%`
  readonly flexGrow?: number
  readonly children?: ReactNode
}

export function Panel({ title, active = false, width, height, flexGrow, children }: PanelProps) {
  const borderColor = active ? '#00BFFF' : '#555555'

  return (
    <box
      border={true}
      borderStyle="rounded"
      borderColor={borderColor}
      title={` ${title} `}
      flexDirection="column"
      {...(width !== undefined ? { width } : undefined)}
      {...(height !== undefined ? { height } : undefined)}
      {...(flexGrow !== undefined ? { flexGrow } : undefined)}
    >
      {children}
    </box>
  )
}
