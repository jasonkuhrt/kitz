// Promise then/catch/finally chains are allowed in test/boundary files
const value = Promise.resolve(1).then((n) => n + 1)

void value
