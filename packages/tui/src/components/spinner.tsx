import { useEffect, useState } from 'react'

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export interface SpinnerProps {
  readonly label?: string
}

export function Spinner({ label = 'Loading...' }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f: number) => (f + 1) % frames.length)
    }, 80)
    return () => clearInterval(interval)
  }, [])

  return (
    <box flexDirection="row">
      <text content={`${frames[frame]} `} fg="#00BFFF" />
      <text content={label} fg="#888888" />
    </box>
  )
}
