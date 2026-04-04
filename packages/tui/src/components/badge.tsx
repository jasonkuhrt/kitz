export interface BadgeProps {
  readonly label: string
  readonly active?: boolean
  readonly color?: string
  readonly activeColor?: string
}

export function Badge({
  label,
  active = false,
  color = '#555555',
  activeColor = '#00BFFF',
}: BadgeProps) {
  const bg = active ? activeColor : undefined
  const fg = active ? '#000000' : color

  return (
    <box paddingLeft={1} paddingRight={1}>
      <text content={active ? ` ${label} ` : label} fg={fg} {...(bg ? { bg } : {})} />
    </box>
  )
}
