export const loadRuntime = () =>
  process.versions.bun ? import('./lang/colorize.bun.js') : import('./lang/colorize.node.js')
