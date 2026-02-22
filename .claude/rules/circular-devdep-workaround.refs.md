# Circular DevDep Workaround - References

Research links for verifying/reconsidering this rule:

- [turborepo#9253](https://github.com/vercel/turborepo/issues/9253) - Feature request for devDep differentiation
- [turborepo#1752](https://github.com/vercel/turborepo/discussions/1752) - Cyclic dependency discussion
- [turborepo#8135](https://github.com/vercel/turborepo/discussions/8135) - Migration issues with cycles

## Key Finding

pnpm accepts dev→prod "cycles" fine. Turbo rejects ALL cycles when building its task graph, regardless of dependency type. This is a Turbo limitation, not a fundamental package manager constraint.
