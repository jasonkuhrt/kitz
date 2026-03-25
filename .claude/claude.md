# CLAUDE.md

@issue.md
@../CONTRIBUTING.md

## Workflow

- Drive meaningful repo workflows through project-defined Bun scripts.
- Do not invoke Vitest directly via `vitest`, `./node_modules/.bin/vitest`, `bunx vitest`, `pnpm vitest`, or similar ad hoc entrypoints.
- Run tests through `bun run <script>` or `bun run --cwd <package> <script>`.
- If a focused test workflow does not exist yet, add an appropriate Bun script first and then run that script.
- Prefer canonical repo or package scripts over one-off shell commands when the workflow matters.
- Treat `oxlint` warnings as blocking. Keep rule severities at `warn` so IDEs do not visually conflate lint findings with type-check errors, but do not close work while any `oxlint` warning is still live.

## Backwards Compatibility

**Default stance: Breaking changes are acceptable.**

This is a pre-1.0 library under active development. Unless explicitly instructed otherwise for a specific task, you should:

- Prioritize clean design over backwards compatibility
- Make breaking changes freely when they improve the API
- Not worry about migration paths or deprecation warnings
- Focus on the best long-term solution

Backwards compatibility will ONLY be considered when explicitly mentioned in the task requirements.
