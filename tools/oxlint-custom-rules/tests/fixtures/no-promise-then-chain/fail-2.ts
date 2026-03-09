const value = Promise.resolve(1)
  .catch(() => 0)
  .finally(() => {
    void 0
  })

void value
