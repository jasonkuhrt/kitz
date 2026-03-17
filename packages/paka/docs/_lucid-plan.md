# Lucid Generation Plan
## Archetype: Library package inside a monorepo
## Voice: Second person, present tense, short technical sentences, motivation before mechanism, no marketing language
## One-liner: `@kitz/paka` turns a package's TypeScript exports into structured interface models, generated docs, and semver-impact reports.
## Content Plan
- [x] Phase 1: Autosearch
- [x] Phase 2.1: One-liner
- [x] Phase 2.2: How-to guides
- [x] Phase 2.3: Reference docs
- [x] Phase 2.4: Conceptual overview
- [x] Phase 2.5: Quickstart
- [x] Phase 2.6: README
- [x] Phase 2.7: Optional content
- [x] Phase 2.8: Landing page
- [x] Phase 3: Verify + Review
- [x] Phase 4: Output
## Findings
- `@kitz/paka` is a library package, not an application. The public surface is exposed from `packages/paka/src/__.ts`.
- The package has four practical areas: interface extraction, schema model exports, Markdown-to-JSDoc conversion, and VitePress generation.
- The new semver work adds a package-root diff workflow through `analyzeSemverImpact`, `analyzeSemverImpactFromProjectRoots`, `renderSemverReport`, and the `paka semver` CLI command.
- The CLI surface is intentionally small: `paka generate` for documentation generation and `paka semver <previous> <next> [--current-version] [--json]` for export-surface comparison.
- The package root currently has no README and no package-local docs. The monorepo root README still says "for now read the code".
- A real-project smoke test against `packages/paka` on `main` vs this worktree exposed a namespace-export docs normalization bug in `extractor/nodes/module.ts`; the branch now fixes that and covers it with regression tests.
- The repo already has a root `docs/` directory and package-local README patterns. Adding a second docs framework inside the monorepo would be noise, so this pass should produce package-local docs files rather than bootstrap a new site stack.
## Exemplars
- `packages/release/README.md` for "pipeline first" package explanation and section structure
- `packages/oxlint-rules/README.md` for concise package-local reference style
## Quality Scores
- Output package: 7 public-facing docs files plus package `README.md`
- Local markdown links: verified for all relative links in generated docs
- Package checks: `bun run --cwd packages/paka check:types`, `bun run --cwd packages/paka test`, and `bun run format:check` passed after the docs changes
- Package lint: `bun run --cwd packages/paka check:lint` still reports the pre-existing `src/schema.ts` schema-class warning backlog and no new docs-related problems
- Docs site: `bun run docs:paka:build` passed and `bun run docs:paka:dev` serves the rendered docs at `http://127.0.0.1:4173/`
- Review mode: cross-context review deferred into `_lucid-review-request.md` because this pass generated more than six documents without delegated review
