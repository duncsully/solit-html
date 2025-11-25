import { SignalBase } from './signals/SignalBase'
import { effects, suppressFalseAsText } from './directives'
import { func } from './directives/FunctionDirective'
import { observe } from './directives/ObserveDirective'
import { html as litHtml } from 'lit-html'
import { type Effect } from './signals/watch'

export const html = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const litValues = values.map((v) => {
    if (v instanceof SignalBase) {
      return observe(v)
    }
    if (v instanceof Function) {
      return func(v)
    }
    if (v === false) {
      return suppressFalseAsText()
    }
    return v
  })
  if (effectFns.length) {
    // Attach all queued effects to this template, doing so before
    // rendering the actual template so it will have access to any
    // changes made by the effects during their first run.
    return litHtml`${effects(
      ...effectFns.splice(0, effectFns.length)
    )}${litHtml(strings, ...litValues)}`
  }
  return litHtml(strings, ...litValues)
}

const effectFns: Effect[] = []
export const effect = (effectFn: Effect) => {
  effectFns.push(effectFn)
}
