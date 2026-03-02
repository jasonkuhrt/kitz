const run = async () => {
  const n = await Promise.resolve(1)
  return n + 1
}

void run
