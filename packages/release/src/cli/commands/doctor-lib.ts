import { Err } from '@kitz/core'
import type { Lifecycle } from '../../api/version/models/lifecycle.js'
import * as Doctor from '../../api/doctor.js'

export const toUnavailableLifecycleReport = (
  lifecycle: Lifecycle,
  required: boolean,
  failure: unknown,
): Doctor.UnavailableLifecycleReport => ({
  _tag: 'UnavailableLifecycleReport',
  lifecycle,
  required,
  reason: Err.ensure(failure).message,
})
