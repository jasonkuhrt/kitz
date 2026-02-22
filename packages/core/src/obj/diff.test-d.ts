// dprint-ignore-file
import { Ts } from '#ts'
import { Type as A } from '#kitz/assert/assert'
import type * as Diff from './diff.js'

A.onAs<Diff.Compute<[1], [0]>>()                                          .exact.of(Ts.as<{ diff_mismatch_: [[1, 0]] }>())
A.onAs<Diff.Compute<[1, string], [0, number]>>()                          .exact.of(Ts.as<{ diff_mismatch_: [[1, 0], [string, number]] }>())
A.onAs<Diff.Compute<[1, string, 3], [1, number, 3]>>()                    .exact.of(Ts.as<{ diff_mismatch_: [Diff._, [string, number], Diff._] }>())
A.onAs<Diff.Compute<[1, 2], [1]>>()                                       .exact.of(Ts.as<{ diff_missing__: [Diff._, 2] }>())
A.onAs<Diff.Compute<[1, 2, 3], [1]>>()                                    .exact.of(Ts.as<{ diff_missing__: [Diff._, 2, 3] }>())
A.onAs<Diff.Compute<[1], [1, 2]>>()                                       .exact.of(Ts.as<{ diff_excess___: [Diff._, 2] }>())
A.onAs<Diff.Compute<[1], [1, 2, 3]>>()                                    .exact.of(Ts.as<{ diff_excess___: [Diff._, 2, 3] }>())
A.onAs<Diff.Compute<[1, string, boolean], [0, string]>>()                 .exact.of(Ts.as<{ diff_mismatch_: [[1, 0], Diff._, Diff._]; diff_missing__: [Diff._, Diff._, boolean] }>())
A.onAs<Diff.Compute<[1, string], [0, string, number, boolean]>>()         .exact.of(Ts.as<{ diff_mismatch_: [[1, 0], Diff._]; diff_excess___: [Diff._, Diff._, number, boolean] }>())
A.onAs<Diff.Compute<[], []>>()                                            .exact.of(Ts.as<{}>())
A.onAs<Diff.Compute<[], [1, 2]>>()                                        .exact.of(Ts.as<{ diff_excess___: [1, 2] }>())
A.onAs<Diff.Compute<[1, 2], []>>()                                        .exact.of(Ts.as<{ diff_missing__: [1, 2] }>())
A.onAs<Diff.Compute<{ a: 1 }, { a: 2 }>>()                                .exact.of(Ts.as<{ diff_mismatch_: { a: { expected: 1; actual: 2 } } }>())
A.onAs<Diff.Compute<{ a: 1; b: 2 }, { a: 1 }>>()                          .exact.of(Ts.as<{ diff_missing__: { b: 2 } }>())
A.onAs<Diff.Compute<{ a: 1 }, { a: 1; b: 2 }>>()                          .exact.of(Ts.as<{ diff_excess___: { b: 2 } }>())
A.onAs<Diff.Compute<readonly [1, 2], readonly [0, 2]>>()                  .exact.of(Ts.as<{ diff_mismatch_: [[1, 0], Diff._] }>())
