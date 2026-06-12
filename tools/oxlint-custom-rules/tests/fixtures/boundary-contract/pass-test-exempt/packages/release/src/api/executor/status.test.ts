import { Cli } from '@kitz/cli'
import { formatExecutionStatus } from '../renderer/execution.js'

export const renderForTest = () => formatExecutionStatus(Cli.run([]))
