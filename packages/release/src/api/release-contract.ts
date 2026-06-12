/**
 * @module api/release-contract
 *
 * Thin re-export of the grouped contract modules under `api/contract/`.
 * Kept so existing importers do not churn; new code should import the
 * focused `./contract/<group>.js` modules directly.
 */
export * from './contract/__.js'

/**
 * Compatibility alias: `PlanDigest` was field-identical to {@link Digest} and
 * has been merged into it. Importers outside the contract modules still
 * reference the old name; collapse this alias when they migrate.
 */
export { Digest as PlanDigest } from './digest.js'
