import { Ansis } from 'ansis'

export namespace Term {
  export const ansi = new Ansis(3)

  export const colors = {
    mute: ansi.gray,
    dim: ansi.dim.gray,
    accent: ansi.yellow,
    alert: ansi.red,
    alertBoldBg: ansi.bgRedBright,
    positiveBold: ansi.bold.green,
    positive: ansi.green,
    secondary: ansi.blue,
  }
}
