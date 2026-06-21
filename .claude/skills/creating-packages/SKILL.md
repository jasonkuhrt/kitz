---
name: creating-packages
description: Create a new @kitz/<concept> package via the Vite+ generator. Scaffolds package.json (live-types exports + effect peer), the layered tsconfigs, and the namespace barrel, then wires it into the workspace.
---

# Creating Packages

A package is a concept. The lighter-weight alternative — extending the
`@kitz/effect` namespaces in place — is the `creating-modules` skill. Use this
skill when a concept warrants its own publishable `@kitz/<name>` package.

Scaffolding is a real Vite+ generator: a Bingo template at
`packages/generator-package`, registered in `vite.config.mts` under
`create.templates` as `package`.

## Steps

1. **Generate** (non-interactive; `vp create` auto-formats the output):

   ```bash
   pnpm exec vp create package -- --name <name> --directory <name> --offline --skip-requests
   ```

   `<name>` is the unscoped name (`color` → `@kitz/color`), scaffolded at
   `packages/<name>`. Add `--description "<one-liner>"` to set the description.
   (Humans can also run `vp create package` interactively — it prompts for the
   directory.)

2. **Wire into the root solution** — tsc project references are not globbed, so
   add the new package to both root solution configs:
   - `tsconfig.development.json` → `references`: `{ "path": "./packages/<name>/tsconfig.development.json" }`
   - `tsconfig.production.json` → `references`: `{ "path": "./packages/<name>/tsconfig.production.json" }`

3. **Link**: `pnpm install`.

4. **Verify**: `pnpm exec vp run check` (format + lint + types) and `pnpm exec vp run build`.

## What the generator produces

```
packages/<name>/
├── package.json              # @kitz/<name>: live-types exports (src .ts dev /
│                             #   build .js publish), effect peer, prepack,
│                             #   files: [build, src]
├── README.md
├── tsconfig.json             # solution pointer → development + production
├── tsconfig.development.json # extends root stage.development template
├── tsconfig.production.json  # extends stage.production + topology.imported
└── src/
    ├── _.ts                  # namespace bundle: export * as <Name> from './__.js'
    └── __.ts                 # implementation barrel (starts empty)
```

The output matches `@kitz/effect` — read it as the canonical example. If the
package shape changes, update the template at
`packages/generator-package/src/template.ts` (and validate by generating a
throwaway package, then `pnpm exec vp run check`).

## Notes

- `@kitz/generator-package` is private (not published); it exists only to drive `vp create`.
- To add a namespace to an existing package (including `@kitz/effect`), use
  `creating-modules` — that is an in-package edit, not a generator.
