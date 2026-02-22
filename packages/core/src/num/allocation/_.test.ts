import { Test } from '#kitz/test'
import { capped, equal, priority, proportional } from './allocation.js'

Test.describe('capped')
  .on(capped)
  .cases(
    // Sum fits in budget → use demands
    [[[1, 2, 3], 10], [1, 2, 3]],
    // Sum fits exactly
    [[[2, 2, 2], 6], [2, 2, 2]],
    // Sum exceeds budget, all exceed even share → split evenly
    [[[4, 4], 6], [3, 3]],
    // Sum exceeds budget, some fit within even share → redistribute surplus
    [[[1, 4, 4], 6], [1, 2.5, 2.5]],
    // Sum exceeds budget, multiple redistribution rounds
    [[[1, 2, 8, 8], 12], [1, 2, 4.5, 4.5]],
    // Single item exceeds budget
    [[[4], 3], [3]],
    // Single item fits
    [[[2], 4], [2]],
  )
  .test()

Test.describe('capped > round: floor')
  .on((demands: number[], budget: number) => capped(demands, budget, { round: 'floor' }))
  .cases(
    [[[1, 4, 4], 6], [1, 2, 2]],
    [[[1, 2, 8, 8], 12], [1, 2, 4, 4]],
  )
  .test()

Test.describe('proportional')
  .on(proportional)
  .cases(
    // Scale up
    [[[1, 2, 3], 12], [2, 4, 6]],
    // Scale down
    [[[10, 20, 30], 30], [5, 10, 15]],
    // No change (ratio = 1)
    [[[1, 2, 3], 6], [1, 2, 3]],
    // All zeros
    [[[0, 0, 0], 10], [0, 0, 0]],
  )
  .test()

Test.describe('equal')
  .on(equal)
  .cases(
    // Divides evenly
    [[3, 12], [4, 4, 4]],
    // Doesn't divide evenly
    [[4, 10], [2.5, 2.5, 2.5, 2.5]],
    // Zero count
    [[0, 10], []],
  )
  .test()

Test.describe('equal > round: floor')
  .on((count: number, budget: number) => equal(count, budget, { round: 'floor' }))
  .cases([[4, 10], [2, 2, 2, 2]])
  .test()

Test.describe('priority')
  .on(priority)
  .cases(
    // Partial allocation
    [[[3, 3, 3], 5], [3, 2, 0]],
    // Full allocation
    [[[2, 2, 2], 10], [2, 2, 2]],
    // Exact budget
    [[[2, 2, 2], 6], [2, 2, 2]],
    // No budget
    [[[3, 3], 0], [0, 0]],
  )
  .test()
