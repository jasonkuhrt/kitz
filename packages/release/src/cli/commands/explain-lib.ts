import { Array as A, Order } from 'effect'
import type { Package } from '../../api/analyzer/workspace.js'

export const createPackagePickerOptions = (packages: readonly Package[]) =>
  A.map(
    A.sortWith(packages, (pkg) => pkg.scope, Order.String),
    (pkg) => ({
      label: pkg.scope,
      value: pkg.name.moniker,
      detail: pkg.name.moniker,
    }),
  )
