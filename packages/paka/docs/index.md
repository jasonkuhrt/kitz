---
layout: home

hero:
  name: "@kitz/paka"
  text: "Read a package's exports as a typed public interface"
  tagline: "Extract interface models, generate docs, and compare export-surface semver impact from real package roots."
  actions:
    - theme: brand
      text: Quickstart
      link: /quickstart
    - theme: alt
      text: Semver guide
      link: /guides/calculate-semver-from-exports
    - theme: alt
      text: Public API
      link: /reference/public-api

features:
  - title: Export-map first
    details: paka starts from package.json exports, resolves the backing source files, and keeps the model anchored to the actual published surface.
  - title: Structured docs model
    details: The extractor keeps signatures, docs, provenance, and source locations together so downstream tools do not have to rediscover them.
  - title: Semver from interface shape
    details: This branch adds a semver analyzer that compares two extracted surfaces and reports none, minor, or major from the public contract alone.
---

## What changed on this branch

The new semver prototype sits on top of the interface model that `@kitz/paka` already extracts. Instead of asking commit messages what changed, it asks the package surface directly.

Use the docs in this site in this order:

1. Read [Overview](/overview) for the mental model and boundaries.
2. Read [Quickstart](/quickstart) if you want the shortest working path.
3. Read [Calculate semver from exports](/guides/calculate-semver-from-exports) for the new branch-specific workflow.
4. Read [Public API](/reference/public-api) when you want the exported names grouped by purpose.
