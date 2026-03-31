# Domain Boundary Extraction

## The Rule

When you find non-domain code inside a package, extract it to the appropriate kitz package. This is the highest-priority refactoring obligation — higher than keeping PRs focused, higher than minimizing the number of packages touched, higher than commit cleanliness.

## What "Non-Domain Code" Means

If a package is doing work that belongs to a different concept — Schema introspection in a command engine, path manipulation in a logging library, string parsing in a test framework — that code must move to the package that owns that concept. The test is simple: would this function make sense as a standalone export from another @kitz package? If yes, it doesn't belong here.

## Why This Is Mandatory

The kitz architecture produces two compounding benefits when domain boundaries are respected:

1. **More utility for the world.** Every function extracted to a utility package becomes available to every other package and every external consumer. Code buried inside a domain package helps exactly one consumer. The same function in @kitz/sch, @kitz/fs, or @kitz/core helps everyone. This is the entire value proposition of a utility ecosystem — upstream everything.

2. **Simpler code at the call site.** The domain package sheds implementation weight. Instead of 30 lines of Schema AST traversal, it calls `Sch.AST.extractLiterals`. The domain code becomes a pure expression of its own concerns. Readers don't need to understand Schema internals to understand command resolution.

These benefits compound over time. Every extraction makes the ecosystem richer and every domain package thinner. The alternative — leaving non-domain code inline because "it's just one function" — is how tech debt accumulates silently until every package is a tangled mess of cross-cutting concerns.

## PR Scope Is Never A Reason To Skip This

Extracting a function to another package means that package becomes part of the PR and part of the release. This is fine. It is always fine. It does not matter if a PR that started in @kitz/cmx now touches @kitz/sch, @kitz/core, and @kitz/fs. The alternative — leaving non-domain code in place to "keep the PR focused" — is tech debt dressed up as discipline. A PR that correctly factors code across five packages is better than a PR that keeps one package's diff small by accumulating obligations it shouldn't own.

Pragmatism applies to commit granularity too. Sometimes the extraction is a single new function export on a utility package plus a one-line import change at the call site. Splitting that across multiple commits or PRs creates churn with zero value. One commit that says `refactor(sch,cmx): extract literal introspection to @kitz/sch` is accurate, tracks every affected package for release, and tells the full story. That is the right unit of work.

## How To Apply This

When writing or reviewing code in any package:

1. **Scan for imports that cross domain boundaries.** If a command engine imports `SchemaAST`, a CLI tool imports `path` manipulation helpers, or a test runner implements its own string diffing — flag it.
2. **Check if the target package exists.** There are 40+ @kitz packages. The home for the code almost certainly already exists (@kitz/sch for Schema, @kitz/fs for filesystem, @kitz/core for general utilities).
3. **Add the function to the target package** with tests. Follow the target package's conventions.
4. **Add the dependency** from the consuming package to the target package. Verify no dependency cycle.
5. **Replace the inline code** with the import. The domain package should now be simpler.
6. **Commit everything together.** The commit message should name all affected packages.

## What This Rule Does NOT Mean

- It does not mean creating new packages for every extracted function. Use existing packages first.
- It does not mean extracting code that is genuinely domain-specific. A scoring algorithm that only makes sense in the context of fuzzy matching belongs in @kitz/fuzzy, not @kitz/core.
- It does not mean over-abstracting. If code is used in exactly one place AND is intrinsically tied to that domain, leave it. The test is whether the function would make sense as a standalone export — not whether it could theoretically be reused.
