import { Test } from '#kitz/test'
import { Str } from '#str'

// list() function tests
Test.describe(`Nat > list > empty`)
  .on(Str.Nat.list)
  .cases([[[]]])
  .test()

Test.describe(`Nat > list > single item`)
  .on(Str.Nat.list)
  .cases([[[`apple`]]])
  .test()

Test.describe(`Nat > list > two items`)
  .on(Str.Nat.list)
  .cases([[[`apple`, `banana`]]])
  .test()

Test.describe(`Nat > list > three or more items`)
  .on(Str.Nat.list)
  .cases(
    [[[`apple`, `banana`, `cherry`]]],
    [[[`a`, `b`, `c`, `d`]]],
  )
  .test()

// ordinal() function tests
Test.describe(`Nat > ordinal > 1st, 2nd, 3rd`)
  .on(Str.Nat.ordinal)
  .cases(
    [[1], `1st`],
    [[2], `2nd`],
    [[3], `3rd`],
  )
  .test()

Test.describe(`Nat > ordinal > 11th, 12th, 13th exceptions`)
  .on(Str.Nat.ordinal)
  .cases(
    [[11], `11th`],
    [[12], `12th`],
    [[13], `13th`],
  )
  .test()

Test.describe(`Nat > ordinal > teens and twenties`)
  .on(Str.Nat.ordinal)
  .cases(
    [[21], `21st`],
    [[22], `22nd`],
    [[23], `23rd`],
    [[24], `24th`],
  )
  .test()

Test.describe(`Nat > ordinal > hundreds and thousands`)
  .on(Str.Nat.ordinal)
  .cases(
    [[101], `101st`],
    [[111], `111th`],
    [[1001], `1001st`],
  )
  .test()

Test.describe(`Nat > ordinal > various`)
  .on(Str.Nat.ordinal)
  .cases(
    [[0], `0th`],
    [[4], `4th`],
    [[42], `42nd`],
    [[100], `100th`],
  )
  .test()

// article() function tests
Test.describe(`Nat > article > regular vowels`)
  .on(Str.Nat.article)
  .cases(
    [[`apple`], `an`],
    [[`elephant`], `an`],
    [[`igloo`], `an`],
    [[`orange`], `an`],
  )
  .test()

Test.describe(`Nat > article > regular consonants`)
  .on(Str.Nat.article)
  .cases(
    [[`banana`], `a`],
    [[`cat`], `a`],
    [[`dog`], `a`],
    [[`zebra`], `a`],
  )
  .test()

Test.describe(`Nat > article > irregular u-words`)
  .on(Str.Nat.article)
  .cases(
    [[`unicorn`], `a`],
    [[`unicycle`], `a`],
    [[`uniform`], `a`],
    [[`university`], `a`],
    [[`user`], `a`],
    [[`unique`], `a`],
  )
  .test()

Test.describe(`Nat > article > irregular euro-words`)
  .on(Str.Nat.article)
  .cases(
    [[`european`], `a`],
    [[`euro`], `a`],
    [[`eulogy`], `a`],
    [[`euphoria`], `a`],
  )
  .test()

Test.describe(`Nat > article > irregular one and ouija`)
  .on(Str.Nat.article)
  .cases(
    [[`one`], `a`],
    [[`ouija`], `a`],
  )
  .test()

Test.describe(`Nat > article > irregular silent h`)
  .on(Str.Nat.article)
  .cases(
    [[`hour`], `an`],
    [[`honor`], `an`],
    [[`honest`], `an`],
    [[`heir`], `an`],
    [[`herb`], `an`],
  )
  .test()

Test.describe(`Nat > article > multi-word strings`)
  .on(Str.Nat.article)
  .cases(
    [[`apple pie`], `an`],
    [[`banana split`], `a`],
    [[`hour ago`], `an`],
  )
  .test()

Test.describe(`Nat > article > hyphenated words`)
  .on(Str.Nat.article)
  .cases(
    [[`apple-based`], `an`],
    [[`user-friendly`], `a`],
  )
  .test()

Test.describe(`Nat > article > possessives`)
  .on(Str.Nat.article)
  .cases(
    [[`apple's`], `an`],
    [[`user's`], `a`],
  )
  .test()

Test.describe(`Nat > article > empty string`)
  .on(Str.Nat.article)
  .cases([[``], `a`])
  .test()

// pluralize() function tests
Test.describe(`Nat > pluralize > basic`)
  .on(Str.Nat.pluralize)
  .cases(
    [[`test`], `tests`],
    [[`apple`], `apples`],
  )
  .test()

Test.describe(`Nat > pluralize > with count`)
  .on(Str.Nat.pluralize)
  .cases(
    [[`test`, 1], `test`],
    [[`test`, 5], `tests`],
  )
  .test()

Test.describe(`Nat > pluralize > with count and inclusive`)
  .on(Str.Nat.pluralize)
  .cases(
    [[`test`, 1, true], `1 test`],
    [[`test`, 5, true], `5 tests`],
  )
  .test()

// plural() function tests
Test.describe(`Nat > plural`)
  .on(Str.Nat.plural)
  .cases(
    [[`test`], `tests`],
    [[`child`], `children`],
    [[`person`], `people`],
  )
  .test()

// singular() function tests
Test.describe(`Nat > singular`)
  .on(Str.Nat.singular)
  .cases(
    [[`tests`], `test`],
    [[`children`], `child`],
    [[`people`], `person`],
  )
  .test()

// isPlural() function tests
Test.describe(`Nat > isPlural`)
  .on(Str.Nat.isPlural)
  .cases(
    [[`tests`], true],
    [[`children`], true],
    [[`test`], false],
    [[`child`], false],
  )
  .test()

// isSingular() function tests
Test.describe(`Nat > isSingular`)
  .on(Str.Nat.isSingular)
  .cases(
    [[`test`], true],
    [[`child`], true],
    [[`tests`], false],
    [[`children`], false],
  )
  .test()
