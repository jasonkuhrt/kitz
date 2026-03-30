/** ASCII-only case folding: A-Z → a-z. Non-ASCII passes through unchanged. */
export const toLower = (charCode: number): number =>
  charCode >= 65 && charCode <= 90 ? charCode + 32 : charCode
