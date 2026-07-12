export type emptyPathMessage = 'The empty string is not a path'
export const emptyPathMessage: emptyPathMessage = 'The empty string is not a path'

export const targetDescription = {
  AbsFile: 'an absolute file path',
  AbsDir: 'an absolute directory path',
  RelFile: 'a relative file path',
  RelDir: 'a relative directory path',
  Abs: 'an absolute path',
  Rel: 'a relative path',
  File: 'a file path',
  Dir: 'a directory path',
  Any: 'a path literal matching the target path type',
} as const

export type targetDescription<$TargetName extends keyof typeof targetDescription> =
  (typeof targetDescription)[$TargetName]

export const validationHint = {
  AbsFile:
    'Absolute file literals must start with / and must not be root, current/parent-only, trailing slash, or normalize to an invalid filename.',
  AbsDir:
    'Absolute directory literals must start with /. Trailing slash is optional for explicit directory targets.',
  RelFile:
    'Relative file literals must not start with / and must not be current/parent-only, trailing slash, or normalize to an invalid filename.',
  RelDir:
    'Relative directory literals must not start with /. Trailing slash is optional for explicit directory targets.',
  Abs: 'Absolute path literals must start with /.',
  Rel: 'Relative path literals must not start with /.',
  File: 'File literals must not be current/parent-only, trailing slash, or normalize to an invalid filename.',
  Dir: 'Directory literals may be absolute or relative. Trailing slash is optional for explicit directory targets.',
  Any: 'Use one of AbsFile, AbsDir, RelFile, RelDir, Abs, Rel, File, or Dir as the target.',
} as const

export type validationHint<$TargetName extends keyof typeof validationHint> =
  (typeof validationHint)[$TargetName]

export type notTarget<
  $Received extends string,
  $Description extends string,
  $Hint extends string,
> = `Path literal '${$Received}' is not ${$Description}. ${$Hint}`

export const notTarget: <
  const $Received extends string,
  const $Description extends string,
  const $Hint extends string,
>(
  received: $Received,
  description: $Description,
  hint: $Hint,
) => notTarget<$Received, $Description, $Hint> = (received, description, hint) =>
  `Path literal '${received}' is not ${description}. ${hint}` as any

export type requiresLiteral<
  $Subject extends string,
  $Suffix extends string,
  $Remedy extends string,
> = `${$Subject} require${$Suffix} a string literal. ${$Remedy}`

export const requiresLiteral: <
  const $Subject extends string,
  const $Suffix extends string,
  const $Remedy extends string,
>(
  subject: $Subject,
  suffix: $Suffix,
  remedy: $Remedy,
) => requiresLiteral<$Subject, $Suffix, $Remedy> = (subject, suffix, remedy) =>
  `${subject} require${suffix} a string literal. ${remedy}` as any

export type groupMismatchMessage =
  'Path arguments must share a group: both absolute or both relative.'

export const groupMismatchMessage: groupMismatchMessage =
  'Path arguments must share a group: both absolute or both relative.'
