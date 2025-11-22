import { describe, expect, it, vi } from 'vitest'
import { html } from '../html'
import { render } from 'lit-html'
import { signal } from '../signals/Signal'
import { effects } from './EffectDirective'
import { computed } from '../signals/ComputedSignal'

describe('effects', () => {
  it('runs effects on mount', () => {
    const effectCheck = vi.fn()
    const Test = () => {
      return html`<p ${effects(effectCheck)}>Test</p>`
    }
    render(Test(), window.document.body)

    expect(effectCheck).toHaveBeenCalledTimes(1)
  })

  it('runs returned cleanup function on unmount', () => {
    const cleanupCheck = vi.fn()
    const Test = () => {
      const effectWithCleanup = () => cleanupCheck
      return html`<p ${effects(effectWithCleanup)}>Test</p>`
    }
    const el = Test()
    render(el, window.document.body)
    render(html``, window.document.body)

    expect(cleanupCheck).toHaveBeenCalledTimes(1)
  })

  it('runs cleanup and effect when any signal dependencies change', () => {
    const sig = signal('Test')
    const effectCheck = vi.fn()
    const cleanupCheck = vi.fn()
    const Test = () => {
      const effect = () => {
        effectCheck(sig.value)
        return cleanupCheck
      }
      return html`<p ${effects(effect)}>${sig}</p>`
    }
    render(Test(), window.document.body)

    expect(effectCheck).toHaveBeenCalledTimes(1)
    expect(cleanupCheck).toHaveBeenCalledTimes(0)

    sig.set('Updated')

    expect(effectCheck).toHaveBeenCalledTimes(2)
    expect(cleanupCheck).toHaveBeenCalledTimes(1)
  })

  it('batches single effect executions', () => {
    const width = signal(2)
    const height = signal(3)
    const getArea = computed(() => width.get() * height.get())
    const subscribeCheck = vi.fn()
    getArea.observe(subscribeCheck)

    const triggerSwap = signal(false)
    // Not explicitly batched, but should be batched by the effect system
    const swap = () => {
      const newWidth = height.get()
      const newHeight = width.get()
      width.set(newWidth)
      height.set(newHeight)
    }

    const Test = () => {
      return html`<p ${effects(swap)}>Test</p>`
    }
    render(Test(), window.document.body)

    triggerSwap.set(true)

    expect(subscribeCheck).not.toHaveBeenCalled()
  })

  it('batches multiple effect executions', () => {
    const count = signal(0)
    const doubled = computed(() => count.get() * 2)
    const subscribeCheck = vi.fn()
    doubled.observe(subscribeCheck)

    // Silly pair of separate effects that modify the same signal back to same value
    const effect1 = () => {
      count.set(count.peek + 1)
    }
    const effect2 = () => {
      count.set(count.peek - 1)
    }
    const Test = () => {
      return html`<p ${effects(effect1, effect2)}>Test</p>`
    }
    render(Test(), window.document.body)

    expect(subscribeCheck).not.toHaveBeenCalled()
  })
})
