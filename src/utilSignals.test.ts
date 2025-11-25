import { beforeEach, describe, expect, it } from 'vitest'
import { urlState } from './utilSignals'

describe('utilSignals', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })
  describe('urlState', () => {
    it('should initialize state from URL parameters', () => {
      window.history.replaceState({}, '', '/?testKey=%22initialValue%22')
      const [value] = urlState('testKey', 'defaultValue')
      expect(value()).toBe('initialValue')
    })

    it('should use default value if URL parameter is absent', () => {
      const [value] = urlState('testKey', 'defaultValue')
      expect(value()).toBe('defaultValue')
    })

    it('should use default value if URL parameter is invalid JSON', () => {
      window.history.replaceState({}, '', '/?testKey=invalidJSON')
      const [value] = urlState('testKey', 'defaultValue')
      expect(value()).toBe('defaultValue')
    })

    it('should update URL parameters when state changes', () => {
      const [value, setValue] = urlState('testKey', 'defaultValue')
      setValue('newValue')
      expect(window.location.search).toBe('?testKey=%22newValue%22')
      expect(value()).toBe('newValue')
    })

    it('should handle multiple keys independently', () => {
      const [, setValue1] = urlState('key1', 'value1')
      const [, setValue2] = urlState('key2', 'value2')
      setValue1('newValue1')
      setValue2('newValue2')

      expect(window.location.search).toContain('key1=%22newValue1%22')
      expect(window.location.search).toContain('key2=%22newValue2%22')
    })
  })
})
