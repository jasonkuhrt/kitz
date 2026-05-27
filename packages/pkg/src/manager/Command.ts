import { Schema } from 'effect'

export class Command extends Schema.Class<Command>('Command')({
  command: Schema.String,
  args: Schema.Array(Schema.String),
}) {
  static is = Schema.is(Command)
  static decode = Schema.decodeUnknownEffect(Command)
  static decodeSync = Schema.decodeUnknownSync(Command)
  static encode = Schema.encodeUnknownEffect(Command)
  static encodeSync = Schema.encodeUnknownSync(Command)
  static equivalence = Schema.toEquivalence(Command)
  static ordered = false as const

  static fromParts = (command: string, args: readonly string[]) =>
    Command.make({ command, args: [...args] })

  get argv() {
    return [this.command, ...this.args]
  }
}
