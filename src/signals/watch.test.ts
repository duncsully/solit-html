import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from './ComputedSignal'
import { signal } from './Signal'
import { watch } from './watch'

describe('watch', () => {
  let unsub: () => void
  afterEach(() => {
    unsub?.()
    unsub = undefined!
  })

  it('runs the callback immediately', () => {
    const number = signal(1)
    const squared = computed(() => number.get() ** 2)
    const effectFn = vi.fn(() => {
      squared.get()
    })
    unsub = watch(effectFn)

    expect(effectFn).toHaveBeenCalled()
  })

  it('runs the callback when any of its dependencies change', () => {
    const number = signal(1)
    const squared = computed(() => number.get() ** 2)
    const effectFn = vi.fn(() => {
      squared.get()
    })
    unsub = watch(effectFn, 'test watcher')
    effectFn.mockReset()

    number.set(2)

    expect(effectFn).toHaveBeenCalled()
  })
})
