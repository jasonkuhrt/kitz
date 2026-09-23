import type * as Path from '../../path/__.js'

/** Encode an existing entry subject for Effect's raw string service. */
export const entrySubject = (path: Path.Any): string => path.toString()
