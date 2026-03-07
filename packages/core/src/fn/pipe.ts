/**
 * Pipe a value through a series of unary functions.
 *
 * @category Composition
 * @param value - The initial value to pipe through the functions
 * @param fns - Functions to apply in sequence, each receiving the output of the previous
 * @returns The final transformed value
 *
 * @example
 * ```typescript
 * const add1 = (x: number) => x + 1
 * const double = (x: number) => x * 2
 * const toString = (x: number) => x.toString()
 *
 * pipe(5, add1, double) // 12
 * pipe(5, add1, double, toString) // "12"
 * ```
 *
 * @remarks
 * - Supports up to 10 functions with full type inference
 * - Each function must be unary (take exactly one parameter)
 * - Does not handle promise chaining - use with synchronous functions
 * - For composing functions without an initial value, use {@link compose}
 */
// oxfmt-ignore
export function pipe<value>(value: value): value
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any>(value: value, f1: f1): ReturnType<f1>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any>(value: value, f1: f1, f2: f2): ReturnType<f2>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any>(value: value, f1: f1, f2: f2, f3: f3): ReturnType<f3>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any, f4 extends (value: ReturnType<f3>) => any>(value: value, f1: f1, f2: f2, f3: f3, f4: f4): ReturnType<f4>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any, f4 extends (value: ReturnType<f3>) => any, f5 extends (value: ReturnType<f4>) => any>(value: value, f1: f1, f2: f2, f3: f3, f4: f4, f5: f5): ReturnType<f5>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any, f4 extends (value: ReturnType<f3>) => any, f5 extends (value: ReturnType<f4>) => any, f6 extends (value: ReturnType<f5>) => any>(value: value, f1: f1, f2: f2, f3: f3, f4: f4, f5: f5, f6: f6): ReturnType<f6>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any, f4 extends (value: ReturnType<f3>) => any, f5 extends (value: ReturnType<f4>) => any, f6 extends (value: ReturnType<f5>) => any, f7 extends (value: ReturnType<f6>) => any>(value: value, f1: f1, f2: f2, f3: f3, f4: f4, f5: f5, f6: f6, f7: f7): ReturnType<f7>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any, f4 extends (value: ReturnType<f3>) => any, f5 extends (value: ReturnType<f4>) => any, f6 extends (value: ReturnType<f5>) => any, f7 extends (value: ReturnType<f6>) => any, f8 extends (value: ReturnType<f7>) => any>(value: value, f1: f1, f2: f2, f3: f3, f4: f4, f5: f5, f6: f6, f7: f7, f8: f8): ReturnType<f8>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any, f4 extends (value: ReturnType<f3>) => any, f5 extends (value: ReturnType<f4>) => any, f6 extends (value: ReturnType<f5>) => any, f7 extends (value: ReturnType<f6>) => any, f8 extends (value: ReturnType<f7>) => any, f9 extends (value: ReturnType<f8>) => any>(value: value, f1: f1, f2: f2, f3: f3, f4: f4, f5: f5, f6: f6, f7: f7, f8: f8, f9: f9): ReturnType<f9>
// oxfmt-ignore
export function pipe<value, f1 extends (value: value) => any, f2 extends (value: ReturnType<f1>) => any, f3 extends (value: ReturnType<f2>) => any, f4 extends (value: ReturnType<f3>) => any, f5 extends (value: ReturnType<f4>) => any, f6 extends (value: ReturnType<f5>) => any, f7 extends (value: ReturnType<f6>) => any, f8 extends (value: ReturnType<f7>) => any, f9 extends (value: ReturnType<f8>) => any, f10 extends (value: ReturnType<f9>) => any>(value: value, f1: f1, f2: f2, f3: f3, f4: f4, f5: f5, f6: f6, f7: f7, f8: f8, f9: f9, f10: f10): ReturnType<f10>

export function pipe(value: any, ...fns: ((value: any) => any)[]) {
  return fns.reduce((value, fn) => fn(value), value)
}
