# @kitz/oxlint-rules

Kitz-first Oxlint rules and presets for agent engineering.

`oxlint` `1.34.x` still loads JSON config files, so the packaged JSON presets are the primary integration path today.

## `.oxlintrc.json`

```json
{
  "extends": ["./node_modules/@kitz/oxlint-rules/configs/recommended.json"]
}
```

Strict mode:

```json
{
  "extends": ["./node_modules/@kitz/oxlint-rules/configs/strict.json"]
}
```

Both JSON presets already load the `kitz` JS plugin and include the built-in `typescript`, `import`, `vitest`, and `promise` plugin set.

## Programmatic Surface

The package also exports typed preset objects from `@kitz/oxlint-rules`:

```ts
import { OxlintRules } from '@kitz/oxlint-rules'

const config = {
  ...OxlintRules.recommendedConfig,
}
```

This is useful for tooling scripts and future Oxlint config loaders, but the JSON presets above are the portable path for current Oxlint CLI releases.
