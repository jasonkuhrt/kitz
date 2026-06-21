# Commit Conventions

Use Conventional Commits for every git commit and PR title:

```text
<type>(<scope>): <description>
```

## Scope

- Use the package name without the `@kitz/` prefix for package changes.
- Comma-separate scopes for multi-package changes.
- Omit the scope for repo-level changes.

Examples:

- `feat(core): add new utility`
- `fix(core, arr): correct shared type narrowing`
- `ci: enable remote cache`

## Types

- `feat`: new capability
- `fix`: bug fix or behavior improvement
- `docs`: code docs such as JSDoc or code comments
- `perf`: performance improvement
- `style`: formatting or whitespace only
- `refactor`: internal code change with no behavior change
- `test`: test-only changes
- `build`: build system or dependency changes
- `ci`: CI configuration changes
- `chore`: maintenance work
- `chore.docs`: README, guides, and other non-code docs

## PR Titles

- PRs are squash-merged, so the PR title is the release-facing source of truth.
- PR titles must also follow Conventional Commits.
- `docs(<scope>)` is for code docs and participates in release semantics.
- `chore.docs` is for README and guide edits and should not be used for code documentation.
- `ci:` and `chore.docs:` PR titles skip code checks other than formatting.

## Bypass

- Only use the `<!-- cc-bypass -->` PR body escape hatch when you are explicitly asked to bypass validation.
