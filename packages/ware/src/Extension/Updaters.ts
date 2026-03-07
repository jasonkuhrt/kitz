import type { Obj } from '@kitz/core'
import type { Data as OverloadData } from '../Overload/_.js'
import type { Extension } from './_.js'

export namespace Updaters {
  export type AddOverload<
    $Extension extends Extension,
    $Overload extends OverloadData,
  > = Obj.UpdateKeyWithAppendOne<$Extension, 'overloads', $Overload>
}
