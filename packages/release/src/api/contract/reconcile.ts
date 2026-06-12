/**
 * @module api/contract/reconcile
 *
 * Reconciliation contracts: classifying divergence between plan, journal,
 * and registry state.
 */
import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Digest } from '../digest.js'

export const ReconcileClassification = Schema.Literals(['clean', 'resume', 'repair', 'abort'])
export type ReconcileClassification = typeof ReconcileClassification.Type

export class ReconcileDecision extends Sch.Class<ReconcileDecision>()('ReconcileDecision', {
  classification: ReconcileClassification,
  planDigest: Digest,
  evidenceIds: Schema.Array(Schema.String),
  stateDiff: Schema.Array(Schema.String),
  nextCommand: Schema.String,
}) {}

export const RepairAction = Schema.Literals([
  'resume',
  'record-remote-success',
  'create-missing-tag',
  'create-missing-github-release',
  'abort-before-mutation',
  'manual-intervention',
])
export type RepairAction = typeof RepairAction.Type
