// `as const` inside function body is a design violation — use constructors or const type params
const makeColors = () => {
  return [`red`, `green`, `blue`] as const
}

void makeColors
