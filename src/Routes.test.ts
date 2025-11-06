import { describe, it, expect, beforeEach } from 'vitest'
import { navigate, Router, setupHistoryRouting } from './Routes'
import { html } from './html'
import { render } from 'lit-html'

describe('navigate', () => {
  describe('when using history routing', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/')
    })
    it('should handle absolute paths', () => {
      setupHistoryRouting()

      navigate('/test')

      expect(window.location.pathname).toBe('/test')

      navigate('/')

      expect(window.location.pathname).toBe('/')
    })

    it('should handle relative paths', () => {
      setupHistoryRouting()

      navigate('test')

      expect(window.location.pathname).toBe('/test')

      navigate('subpage')

      expect(window.location.pathname).toBe('/test/subpage')

      navigate('..')

      expect(window.location.pathname).toBe('/test')
    })

    it('should handle absolute paths with basePath', () => {
      setupHistoryRouting({ base: '/base' })

      const el = html`${Router({
        '/': () => html`<p>Home</p>`,
        '/test': () => html`<p>Test</p>`,
      })}`
      render(el, window.document.body)

      expect(window.document.body.textContent).toBe('Home')

      navigate('/test')

      expect(window.location.pathname).toBe('/base/test')
      expect(window.document.body.textContent).toBe('Test')
    })

    it('should handle relative paths with basePath', () => {
      setupHistoryRouting({ base: '/base' })
      const el = html`${Router({
        '/': () => html`<p>Home</p>`,
        '/test': () => html`<p>Test</p>`,
      })}`
      render(el, window.document.body)

      expect(window.document.body.textContent).toBe('Home')

      navigate('test')

      expect(window.location.pathname).toBe('/base/test')
      expect(window.document.body.textContent).toBe('Test')

      navigate('..')

      expect(window.location.pathname).toBe('/base/')
      expect(window.document.body.textContent).toBe('Home')
    })
  })
})
