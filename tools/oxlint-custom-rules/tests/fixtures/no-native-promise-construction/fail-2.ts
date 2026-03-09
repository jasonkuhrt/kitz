const task = new globalThis.Promise<number>((resolve) => {
  resolve(1)
})

void task
