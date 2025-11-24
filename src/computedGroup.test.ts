import { describe, expect, it, vi } from 'vitest'
import { computedGroup } from './computedGroup'
import { signal } from './signals/Signal'

describe('computedGroup', () => {
  it('returns computeds for each value', () => {
    const numbers = [1, 2, 3, 5, 7, 8]

    const { odd, even } = computedGroup(() => {
      const odd = numbers.filter((n) => n % 2 === 1)
      const even = numbers.filter((n) => n % 2 === 0)
      return { odd, even }
    })

    expect(odd.get()).toEqual([1, 3, 5, 7])
    expect(even.get()).toEqual([2, 8])
  })

  it('works with arrays', () => {
    const numbers = [1, 2, 3, 5, 7, 8]

    const [odd, even] = computedGroup(() => {
      const odd = numbers.filter((n) => n % 2 === 1)
      const even = numbers.filter((n) => n % 2 === 0)
      return [odd, even]
    })

    expect(odd.get()).toEqual([1, 3, 5, 7])
    expect(even.get()).toEqual([2, 8])
  })

  it('does not recompute individual computeds when unrelated parts change', () => {
    const numbers = signal([1, 2, 3, 5, 7, 8])
    const [evenCount] = computedGroup(() => {
      const odd = numbers.value.filter((n) => n % 2 === 1)
      const even = numbers.value.filter((n) => n % 2 === 0)
      return [even.length, odd.length]
    })

    const evenSpy = vi.fn()
    evenCount.subscribe(evenSpy)
    evenSpy.mockClear()

    numbers.set([...numbers.value, 9]) // add an odd number, shouldn't affect evenCount

    expect(evenSpy).not.toHaveBeenCalled()
  })
})
