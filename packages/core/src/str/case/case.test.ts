import { Test } from '#kitz/test'
import { Str } from '#str'

// Test constant case conversion
Test.describe(`Case > constant`)
  .on(Str.Case.constant)
  .cases(
    [[`helloWorld`], `HELLO_WORLD`],
    [[`foo-bar`], `FOO_BAR`],
    [[`myEnvVar`], `MY_ENV_VAR`],
    [[`PascalCase`], `PASCAL_CASE`],
    [[`kebab-case-string`], `KEBAB_CASE_STRING`],
    [[`already_snake`], `ALREADY_SNAKE`],
    [[`ALREADY_CONSTANT`], `ALREADY_CONSTANT`],
  )
  .test()
