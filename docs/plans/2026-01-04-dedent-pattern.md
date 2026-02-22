# Dedent Pattern for Static CLI Output

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish `Str.Tpl.dedent` as the idiomatic pattern for static multi-line CLI output.

**Architecture:** Add a brief section to `kitz-cli-output` skill distinguishing `Str.Builder` (dynamic) from `Str.Tpl.dedent` (static). Update table. Refactor one example.

**Tech Stack:** @kitz/core (Str module), Effect Console

---

### Task 1: Update kitz-cli-output Skill

**Files:**

- Modify: `.claude/skills/kitz-cli-output/SKILL.md`

**Step 1: Add "Static Blocks" section after line 33 (after Core Pattern code block)**

````markdown
## Static Blocks

For static text (no loops, no conditionals), prefer `Str.Tpl.dedent`:

```typescript
yield * Console.log(Str.Tpl.dedent`
  Done! Release is ready.

  Next steps:
    1. Review release.config.ts
    2. Run \`release status\` to see pending changes
`)
```
````

Single expression, no `.render()`. Use `Str.Builder` when content is dynamic.

````
**Step 2: Update "When to Use What" table (line 166-172)**

Replace:
```markdown
| Scenario                  | Approach                             |
| ------------------------- | ------------------------------------ |
| Multi-line static output  | `Str.Builder` + single `Console.log` |
| Multi-line with loops     | `Str.Builder` + single `Console.log` |
| Real-time progress/events | Individual `Console.log` calls       |
| Single line               | Direct `Console.log`                 |
| Error messages            | `Str.Builder` + `Console.error`      |
````

With:

```markdown
| Scenario                     | Approach                       |
| ---------------------------- | ------------------------------ |
| Static multi-line            | `Str.Tpl.dedent`               |
| Dynamic (loops/conditionals) | `Str.Builder`                  |
| Real-time progress/events    | Individual `Console.log` calls |
| Single line                  | Direct `Console.log`           |
```

---

### Task 2: Refactor init.ts to Use dedent

**Files:**

- Modify: `packages/release/src/cli/commands/init.ts:79-87`

**Step 1: Replace Builder with dedent**

From:

```typescript
const s = Str.Builder()
s``
s`Done! Release is ready.`
s``
s`Next steps:`
s`  1. Review release.config.ts`
s`  2. Run \`release status\` to see pending changes`
s`  3. Run \`release plan stable\` to generate a release plan`
yield * Console.log(s.render())
```

To:

```typescript
yield * Console.log(Str.Tpl.dedent`

  Done! Release is ready.

  Next steps:
    1. Review release.config.ts
    2. Run \`release status\` to see pending changes
    3. Run \`release plan stable\` to generate a release plan
`)
```

**Step 2: Run type check**

Run: `pnpm turbo run check:types --filter=@kitz/release`
Expected: No errors

---

## Decision Log

`Str.Builder` = accumulator for dynamic content. `Str.Tpl.dedent` = single expression for static blocks.
