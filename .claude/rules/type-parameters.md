# Type parameter names

Prefix every TypeScript type parameter identifier and all of its references with `$`, including function, type alias, interface, class, mapped-type, and `infer` parameters.

Ambient declaration-merging parameters must retain an upstream declaration's spelling when TypeScript requires an identical parameter list.

```ts
type FromLiteral<$S extends string> = string extends $S ? Any : AnalyzeLiteral<$S>
```

Rationale: distinguishes type-level identifiers from value/runtime type names at a glance.
