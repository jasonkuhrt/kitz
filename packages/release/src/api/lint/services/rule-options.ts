import { Context } from 'effect'

/** Service providing rule-specific options (pre-validated at config resolution). */
export class RuleOptionsService extends Context.Tag('RuleOptionsService')<RuleOptionsService, unknown>() {}
