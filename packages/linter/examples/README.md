# `@kitz/linter` Examples

These files are design examples. They are written as if `@kitz/linter` already exists.

Each file is intentionally self-contained enough to copy into a repo and adapt:

- [polen-diagnostics.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/polen-diagnostics.example.ts): unify Polen's existing diagnostics into one audit surface
- [release-doctor.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/release-doctor.example.ts): release doctor as audit programs plus a lifecycle suite
- [os-doctor.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/os-doctor.example.ts): root suite over typed probe doctors
- [bookmarks-doctor.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/bookmarks-doctor.example.ts): read-only checklist doctor with guidance
- [dotctl-doctor.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/dotctl-doctor.example.ts): categorized doctor with `pass`/`warn`/`fail`/`skip`
- [crossmod-doctor.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/crossmod-doctor.example.ts): audit doctor with `suggestion` findings and safe fix mode
- [flo-doctor.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/flo-doctor.example.ts): pure probe snapshot
- [shan-skills-doctor.example.ts](/Users/jasonkuhrt/projects/jasonkuhrt/kitz/packages/linter/examples/shan-skills-doctor.example.ts): audit doctor with reconciliation fixes and fix-history handoff

The examples pressure-test these DX requirements:

- programs own fact collection via `.collect(...)`
- `.needs(...)` narrows optional facts to non-null values
- `audit`, `probe`, and `suite` are distinct first-class program kinds
- `services` are first-class and separate from user input
- probe programs should default to identity output when `.run(...)` is omitted
- suite children with empty input should not need `input: () => ({})`
- `inputWhen(...)` should collapse gating and input derivation into one callback
- `check` vs `fix` belongs on `run(...).mode`, not in program input
- `safeFix` belongs on findings, not on a separate rule-level fix API
- render grouping is metadata, not string parsing of rule IDs
