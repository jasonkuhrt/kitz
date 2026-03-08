import * as ansis from 'ansis'

export namespace Term {
  export const colors = {
    mute: ansis.gray,
    dim: ansis.dim.gray,
    accent: ansis.yellow,
    alert: ansis.red,
    alertBoldBg: ansis.bgRedBright,
    positiveBold: ansis.bold.green,
    positive: ansis.green,
    secondary: ansis.blue,
  }
}
