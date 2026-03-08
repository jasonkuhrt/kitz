const drain = async (
  stream: ReadableStream<Uint8Array> | null,
  writer: NodeJS.WriteStream,
): Promise<void> => {
  if (!stream) return

  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    if (value) writer.write(Buffer.from(value))
  }
}

const child = Bun.spawn(
  ['./node_modules/.bin/vitest', 'run', '--root', '.', 'packages/release/src'],
  {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  },
)

const stdoutPromise = drain(child.stdout, process.stdout)
const stderrPromise = drain(child.stderr, process.stderr)
const exitCode = await child.exited
await Promise.all([stdoutPromise, stderrPromise])

if (exitCode !== 0) {
  process.exit(exitCode)
}
