---
name: creating-rules
description: Use when adding project conventions, coding rules, or guidelines. Determines correct location and scoping based on which packages the rule applies to.
---

# Creating Rules

Determine correct location and scoping for new conventions/rules.

## Decision Tree

```
Does rule apply to ONE specific package?
├─ YES → packages/<name>/.claude/CONVENTIONS.md
│        (auto-loaded by package-conventions rule)
│
└─ NO → .claude/rules/<topic>.md
        │
        Does it apply to ALL packages?
        ├─ YES → paths: "packages/**/*"
        │        (or omit paths for truly global)
        │
        └─ NO → Use YAML array:
                paths:
                  - "packages/core/**/*"
                  - "packages/cli/**/*"
```

## File Formats

### Single Package Convention

Location: `packages/<name>/.claude/CONVENTIONS.md`

```markdown
# <Package> Package Conventions

Package-specific development conventions for `@kitz/<name>`.

## <Topic>

<content>
```

No frontmatter needed - auto-loaded by the package-conventions rule.

### Multi-Package or Global Rule

Location: `.claude/rules/<topic>.md`

```markdown
---
paths:
  - "packages/core/**/*"
  - "packages/cli/**/*"
---

# <Topic>

<content>
```

**Important:** Always quote glob patterns (YAML reserves `*` and `{`).

### Path Patterns

| Pattern                | Matches              |
| ---------------------- | -------------------- |
| `"packages/**/*"`      | All packages         |
| `"packages/core/**/*"` | Single package       |
| `"**/*.ts"`            | All TypeScript files |
| `"!**/*.test.ts"`      | Exclude test files   |

## Examples

**Rule for core package only:**
→ `packages/core/.claude/CONVENTIONS.md`

**Rule for packages using Effect services:**
→ `.claude/rules/effect-services.md` with paths array listing those packages

**Rule for all code:**
→ `.claude/rules/<topic>.md` with `paths: "packages/**/*"` or no paths

## Reference Files (Token Optimization)

Rules are auto-loaded into context. To save tokens, put research links and detailed rationale in a separate `.refs.md` file:

```
.claude/rules/
├── my-rule.md          ← Auto-loaded (keep concise)
└── my-rule.refs.md     ← NOT auto-loaded (link to it)
```

In the rule, add:

```markdown
## References

See [my-rule.refs.md](./my-rule.refs.md)
```

The refs file can contain:

- Research links for future verification
- Detailed rationale/history
- Related discussions
- Anything useful for humans but not needed in every context
