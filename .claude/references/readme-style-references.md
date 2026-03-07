# README Style References

Curated READMEs that demonstrate excellent conceptual prose, progressive disclosure, and teaching quality. Collected as input for @kitz/release README design.

## Selection Criteria

- Rich prose that teaches concepts, not just lists features
- Progressive disclosure — ideas unfold in a natural order
- Diagrams, analogies, or structural techniques that build understanding
- Every sentence does conceptual work

## Tier 1: Gold Standard (dataloader-quality prose)

### [graphql/dataloader](https://github.com/graphql/dataloader)

- **Conceptual hook:** N+1 → batching → caching as derivable solutions
- **Teaching technique:** Narrative-first. Explains the N+1 problem concretely, then builds the solution from first principles. Distinguishes memoization cache from shared application cache — a subtle but crucial distinction that prevents misuse. Shows constraints of the batch function as derivable from the problem, not arbitrary API choices.
- **Prose quality:** Dense, precise, explanatory — every sentence does conceptual work rather than asserting features.
- **Length:** ~3,000 words

### [kriskowal/q](https://github.com/kriskowal/q)

- **Conceptual hook:** Promises as un-inverting the inversion of control — restoring I/O separation that callbacks destroyed
- **Teaching technique:** Opens with the "Pyramid of Doom" as a visual argument, then delivers the key insight: "Promises un-invert the inversion, cleanly separating the input arguments from control flow arguments." Uses try/catch/finally as structural analogy for rejection semantics.
- **Prose quality:** Crisp and argumentative — it argues for why this mental model is correct, not just describes.
- **Length:** ~5,000 words

### [ReactiveX/RxJava](https://github.com/ReactiveX/RxJava/tree/3.x)

- **Conceptual hook:** Observable sequences as unified abstraction; temporal vocabulary (assembly/subscription/runtime) makes dataflow lifecycle explicit
- **Teaching technique:** Introduces a three-phase vocabulary most reactive docs skip — terms that let readers reason about _when_ things happen. Backpressure explained through consequences. Upstream/downstream uses spatial metaphor. Five base classes motivated by the trade-offs they represent.
- **Prose quality:** Technically dense but grounded — vocabulary sections read like a glossary that actually teaches.
- **Length:** ~6,000 words

### [nickel-lang/nickel](https://github.com/nickel-lang/nickel)

- **Conceptual hook:** Configuration language design as deliberate trade-offs: gradual typing, contracts as schemas, Turing-completeness vs. safety
- **Teaching technique:** Each trait has a "why": types improve quality _in particular for functions_; data is mostly static _so dynamic errors suffice_. The motto "Great defaults, design for extensibility" is elaborated with reasoning. 9-language comparison table grounds choices in the ecosystem.
- **Prose quality:** Confident and opinionated — the writing has a point of view, not just descriptions.
- **Length:** ~3,500 words

## Tier 2: Strong Conceptual Teaching (different strengths)

### [immutable-js/immutable-js](https://github.com/immutable-js/immutable-js)

- **Conceptual hook:** Persistent data structures as values rather than objects — why this distinction changes reasoning about change, equality, and identity
- **Teaching technique:** Separates "immutable" from "persistent" explicitly. Explains value vs. reference equality as a consequence of the data model. Shows `===` as optimization — if reference is identical, data definitely hasn't changed.
- **Prose quality:** Clear and philosophically grounded; equality semantics explained as design, not arbitrary choice.
- **Length:** ~4,000 words

### [HikariCP wiki: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)

- **Conceptual hook:** Database connection pools should be _smaller_ than intuition suggests — grounded in CPU scheduling and queueing theory
- **Teaching technique:** Leads with counter-intuitive claim, then proves from first principles using CS fundamentals. Derives the PostgreSQL formula from the analysis rather than presenting as received wisdom. Distinguishes SSD from spinning disk as concrete implication.
- **Prose quality:** Argumentative and rigorous — it's a proof, not just advice.
- **Length:** ~1,500 words (wiki page, not README)

### [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer)

- **Conceptual hook:** Distributed systems trade-offs as structured knowledge — CAP, consistency patterns, caching strategies
- **Teaching technique:** Trade-off pairs (consistency vs. availability, SQL vs. NoSQL, cache-aside vs. write-through) presented as genuine design decisions with reasons for each side. Availability numbers make abstract SLAs concrete.
- **Prose quality:** Encyclopedic rather than narrative; better as reference than mini-textbook.
- **Length:** Very long (~30,000 words). Learning repository, not a library README.

## Tier 3: Notable Techniques

### [sinclairzx81](https://github.com/sinclairzx81)

- **Style:** High signal-to-noise ratio across multiple TypeScript library READMEs (TypeBox, LinqBox, etc.)
- **Technique:** Maximally dense information delivery — every line earns its place. Good model for "no wasted words" technical writing in the TypeScript ecosystem.

### [jamiebuilds/the-super-tiny-compiler](https://github.com/jamiebuilds/the-super-tiny-compiler)

- **Conceptual hook:** Compiler phases (tokenizing → parsing → transforming → code generation) taught in ~200 lines
- **Teaching technique:** The most textbook-quality conceptual prose found in any repository — but it lives in source file comments, not the README. Each phase introduced with an analogy, then implemented.
- **Prose quality:** Exceptional pedagogical writing. Worth studying for voice and pacing even though the format is different.
- **Note:** Prose is in the source code, not the README.

## Anti-Patterns (what to avoid)

| Pattern                 | Example           | Problem                                                        |
| ----------------------- | ----------------- | -------------------------------------------------------------- |
| Badge wall              | vite, biome       | Credibility signaling without teaching                         |
| Social proof list       | changesets        | Adopter names don't help you understand the tool               |
| Marketing minimal       | prettier, drizzle | "Show don't tell" works for obvious tools, not conceptual ones |
| Philosophical manifesto | htmx              | Wins hearts but doesn't build understanding                    |
| Ecosystem index         | effect-ts/effect  | Navigation document, not conceptual prose                      |
| Pure API reference      | sindresorhus/ky   | Exhaustive but not progressive — reference, not teaching       |
