export const loadRuntime = async () => {
  if ('Bun' in globalThis) {
    return await import('@effect/sql-sqlite-bun')
  }

  return await import('@effect/sql-sqlite-node')
}
