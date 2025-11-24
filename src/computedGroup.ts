import { ComputedSignal, computed } from './signals/ComputedSignal'
import { type ReactiveGetter } from './types'

type Return<T> = T extends Array<infer V>
  ? ComputedSignal<V>[]
  : { [K in keyof T]: ComputedSignal<T[K]> }

export function computedGroup<T extends object | unknown[]>(getter: () => T) {
  const whole = computed(getter)
  const wholeValue = whole.peek
  if (Array.isArray(wholeValue)) {
    return wholeValue.map((_, i) =>
      computed(() => whole.get()[i as keyof T])
    ) as Return<T>
  }
  return Object.keys(wholeValue).reduce((acc, key) => {
    acc[key as keyof T] = computed(() => whole.get()[key as keyof T])
    return acc
  }, {} as { [K in keyof T]: ComputedSignal<T[K]> }) as Return<T>
}

type MemoReturn<T> = T extends Array<infer V>
  ? ReactiveGetter<V>[]
  : { [K in keyof T]: ReactiveGetter<T[K]> }

/**
 * Transforms a getter function that returns an object or array into a respective
 * object or array of memoized reactive getters for each property or index.
 * @param getter
 * @returns
 */
export function memoGroup<T extends object | unknown[]>(
  getter: () => T
): MemoReturn<T> {
  const whole = computed(getter)
  const wholeValue = whole.peek
  if (Array.isArray(wholeValue)) {
    return wholeValue.map(
      (_, i) => computed(() => whole.get()[i as keyof T]).get
    ) as MemoReturn<T>
  }
  return Object.keys(wholeValue).reduce((acc, key) => {
    acc[key as keyof T] = computed(() => whole.get()[key as keyof T]).get
    return acc
  }, {} as { [K in keyof T]: () => T[K] }) as MemoReturn<T>
}
