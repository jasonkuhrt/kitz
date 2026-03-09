---
name: syncing-tsconfig-paths
description: Synchronizes tsconfig.json paths from package.json imports field. Ensures TypeScript resolves subpath imports (#imports) correctly during development.
---

# Syncing TSConfig Paths

Tsconfig paths are automatically kept in sync with package.json subpath imports by the `kitz/subpath-imports-integrity` oxlint rule (Check 5: tsconfig drift).

## How It Works

The lint rule (`tools/oxlint-custom-rules/plugin.mjs`) compares tsconfig.json paths against package.json imports for each package. When drift is detected, it:

1. Reports a `subpathImportsIntegrityTsconfigDrift` diagnostic
2. Auto-fixes the tsconfig.json by writing corrected paths

## Manual Sync

Run the linter to trigger the autofix:

```bash
pnpm check:lint
```

## Auditing

Check for drift without fixing:

```bash
pnpm check:lint 2>&1 | grep "subpath-imports-integrity"
```

## Reference

The rule transforms package.json imports to tsconfig paths:

```
"#pkg": "./src/_.ts"  →  "#pkg": ["./src/_.js"]
```

Key behavior:

- `#kitz/*` entries are preserved (manually maintained for circular devDep workaround)
- Conditional imports (objects with browser/default) are skipped
- Extension is changed from `.ts` to `.js` (TypeScript with nodenext resolves `.js` → `.ts`)
