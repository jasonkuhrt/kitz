// Module-scope `as const` is a legitimate data definition pattern
const colors = [`red`, `green`, `blue`] as const

const config = {
  host: `localhost`,
  port: 3000,
} as const

void colors
void config
