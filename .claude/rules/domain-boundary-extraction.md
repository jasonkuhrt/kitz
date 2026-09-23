# Domain Boundary Extraction

## The rule

`@kitz/effect` is organized into namespaces, one per concept: `Path`,
`Schema`, `String`, `Tuple`, `Types`, and so on. When code in one namespace does
work that belongs to another concept, move it to the namespace that owns that
concept. Examples: Schema AST introspection inside `Path`, string parsing inside
a test helper, or path manipulation inside `Schema`.

The test: would this function make sense as a standalone export of another
namespace? If yes, it doesn't belong where it is.

## Why

1. **More utility.** A function exported from its owning namespace helps every
   caller in the package and every consumer. The same function buried inside
   another namespace helps exactly one call site.
2. **Simpler call sites.** The namespace sheds implementation weight and
   expresses only its own concerns. `Path` calling `Schema.<helper>` reads
   better than thirty lines of Schema internals inlined into a path operation.

## Change size is never a reason to skip it

Moving a function to its owning namespace makes that namespace part of the
change. That is always fine. One commit that adds the export, uses it at the
call site, and names every touched scope (`refactor(effect): …`) is the right
unit of work.

## How to apply

1. Scan for imports and helpers that cross concepts.
2. Find the owning namespace. If none exists yet, add one; see the
   `creating-modules` skill.
3. Add the function there with tests, following that namespace's conventions.
4. Replace the inline code with the import.

## What this rule does not mean

- It doesn't mean creating a namespace for every extracted function. Use
  existing namespaces first.
- It doesn't mean extracting genuinely domain-specific code. The test is whether
  the function makes sense as a standalone export, not whether it could in
  theory be reused.
