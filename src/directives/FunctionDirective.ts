import { observe } from './ObserveDirective'
import {
  AsyncDirective,
  PartInfo,
  PartType,
  directive,
} from 'lit-html/async-directive.js'
import { ComputedSignal, computed } from '../signals/ComputedSignal'
import { batch } from '../signals/Signal'
import { SignalBase } from '../signals/SignalBase'

export class FunctionDirective extends AsyncDirective {
  static signalCache = new WeakMap<Function, ComputedSignal<any>>()
  constructor(partInfo: PartInfo) {
    super(partInfo)
    this.isEvent = partInfo.type === PartType.EVENT
  }

  isEvent: boolean

  render(func: Function) {
    if (this.isEvent) {
      return (...forward: unknown[]) => batch(() => func(...forward))
    }
    const mappedSignal = SignalBase._getToSignalMap.get(func as () => void)
    if (mappedSignal) {
      return observe(mappedSignal)
    }
    if (!FunctionDirective.signalCache.has(func)) {
      FunctionDirective.signalCache.set(func, computed(func as () => void))
    }
    return observe(FunctionDirective.signalCache.get(func)!)
  }
}
/**
 * A directive automatically applied to functions inside of solit-html templates.
 *
 * If the function is an event handler, it will be wrapped in `batch`.
 *
 * Otherwise, it will be converted to a ComputedSignal and observed.
 */
export const func = directive(FunctionDirective)
