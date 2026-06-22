# @kitz/generator-package

A Vite+ ([Bingo](https://www.create.bingo)) generator that scaffolds a new
`@kitz/<concept>` package on the kitz toolchain — live-types exports, the
`effect` peer dependency, the layered tsconfig set, and the namespace barrel.

Registered in the root `vite.config.mts` under `create.templates` as `package`.
Run it via:

```bash
vp create package -- --name color --description "Color utilities"
```

Then wire the new package into the root solution and install (the generator
prints these as suggestions). The `creating-packages` skill drives the full
workflow.
