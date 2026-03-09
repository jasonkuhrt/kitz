/**
 * Runtime platform identifier.
 */
export type Platform = 'node' | 'bun' | 'browser' | 'unknown'

/**
 * Operating system identifier.
 *
 * @see https://nodejs.org/api/process.html#processplatform
 */
export type Os = 'aix' | 'darwin' | 'freebsd' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'android'

/**
 * CPU architecture identifier.
 *
 * @see https://nodejs.org/api/process.html#processarch
 */
export type Arch =
  | 'arm'
  | 'arm64'
  | 'ia32'
  | 'loong64'
  | 'mips'
  | 'mipsel'
  | 'ppc64'
  | 'riscv64'
  | 's390'
  | 's390x'
  | 'x64'
