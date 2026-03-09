/**
 * @category Basic Functions
 */
export const constant =
  <value>(value: value): (() => value) =>
  () =>
    value
