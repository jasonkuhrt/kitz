# Yaml Package

## What

Add `@kitz/yaml` as a real public package for schema-first YAML parsing and typed YAML file resources.

## Why

YAML already appears across the sibling repo fleet and is a repeated domain, not temporary glue:

- `bookmarks`
- `dotfiles`
- `os`
- `telescope`

That makes YAML a justified `kitz` boundary now. It should not stay as raw external parsing calls scattered through consumer repos.

## How

- expose `Yaml.parseYaml()` as a `Schema<unknown, string>`
- expose `Yaml.createResource()` as a thin typed wrapper around `@kitz/resource`
- wire the package into the `kitz` metapackage
- add package-level tests for decode, encode, and resource round-tripping

## Where

- `packages/yaml/*`
- `packages/kitz/src/yaml.ts`
- `packages/kitz/package.json`
- `README.md`

## When

Adopt this package first in repos currently depending on `yaml`, then use the fleet scan to surface the next missing domain.

## Verification

- `bun run --cwd packages/yaml test`
- `bun run --cwd packages/yaml check:lint`
- `bun run --cwd packages/yaml check:types`

## Risks

- current scope is codec/resource only; deeper YAML document editing APIs may still be needed later
