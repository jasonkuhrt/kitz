import { Sch } from '@kitz/sch'
import { Schema } from 'effect'

export class Command extends Sch.Class<Command>()('Command', {
  command: Schema.String,
  args: Schema.Array(Schema.String),
}) {
  static fromParts = (command: string, args: readonly string[]) =>
    Command.make({ command, args: [...args] })

  get argv() {
    return [this.command, ...this.args]
  }
}
