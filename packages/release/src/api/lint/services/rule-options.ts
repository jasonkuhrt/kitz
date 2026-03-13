import { ServiceMap } from 'effect'

/** Service providing rule-specific options (pre-validated at config resolution). */
export class RuleOptionsService extends ServiceMap.Service<RuleOptionsService, unknown>()(
  'RuleOptionsService',
) {}
