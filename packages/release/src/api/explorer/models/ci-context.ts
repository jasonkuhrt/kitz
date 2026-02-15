/**
 * Where this release execution is running.
 */
export interface CiContext {
  readonly detected: boolean
  readonly provider: 'github-actions' | 'generic' | null
}
