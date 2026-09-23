# Error Conventions

## Defining errors

Define errors as Effect schema-backed tagged errors, tagged with their fully
qualified `@kitz/effect/<Namespace>/<Name>` identifier:

```typescript
import { Schema as S } from 'effect'

export class CwdError extends S.TaggedError<CwdError>()('@kitz/effect/Path/CwdError', {
  cause: S.Defect(),
}) {}
```

- Fields are schemas, so errors encode, decode and compare like any other value.
- Keep the fields to what a caller needs to handle or report the failure.

## Where errors live

Export each error from the namespace barrel next to the operations that fail
with it (`Path.CwdError`), not from a package-wide `Errors` namespace.

## Upstream failures pass through

Don't wrap failures Effect already types. Platform failures stay
`PlatformError`, and schema failures stay `Schema.SchemaError`. Define a Kitz
error only when Kitz adds a failure of its own, such as a host-reported string
that isn't a valid Kitz path.
