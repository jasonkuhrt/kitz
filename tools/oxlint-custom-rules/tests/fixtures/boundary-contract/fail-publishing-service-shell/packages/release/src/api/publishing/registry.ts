import { Context } from 'effect'

export class PackageRegistry extends Context.Service<PackageRegistry>()('PackageRegistry', {}) {}
