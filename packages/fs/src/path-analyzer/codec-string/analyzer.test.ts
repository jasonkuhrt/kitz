import { Test } from '@kitz/test'
import { analyze } from './analyzer.js'

Test.describe('hint option').on(analyze)
  .casesInput(
    // Without hint: dotfiles without extensions default to directory
    ['./.gitignore'],
    ['./.env'],
    ['./readme'],
    ['/etc/hosts'],
    // With file hint: dotfiles treated as files
    ['./.gitignore', { hint: 'file' }],
    ['./.env', { hint: 'file' }],
    ['./readme', { hint: 'file' }],
    ['/etc/hosts', { hint: 'file' }],
    // With directory hint: same as default for ambiguous
    ['./.gitignore', { hint: 'directory' }],
    // Clear extensions always file (hint doesn't matter)
    ['./config.json'],
    ['./config.json', { hint: 'directory' }],
    ['./.env.local'],
    // Trailing slash always directory (hint doesn't matter)
    ['./src/'],
    ['./src/', { hint: 'file' }],
  )
  .test()
