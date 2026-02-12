import { describe, it, expect, beforeEach } from 'vitest'
import { navigate, Router, setupRouting } from './Routes'
import { html } from './html'
import { render } from 'lit-html'

describe('navigate', () => {
  describe('when using history routing', () => {
    beforeEach(() => {
      window.history.pushState({}, '', '/')
    })
    it('should handle absolute paths', () => {
      setupRouting({ useHistory: true })

      navigate('/test')

      expect(window.location.pathname).toBe('/test')

      navigate('/')

      expect(window.location.pathname).toBe('/')
    })

    it('should handle relative paths', () => {
      setupRouting({ useHistory: true })

      navigate('test')

      expect(window.location.pathname).toBe('/test')

      navigate('subpage')

      expect(window.location.pathname).toBe('/test/subpage')

      navigate('..')

      expect(window.location.pathname).toBe('/test')
    })

    it('should handle absolute paths with basePath', () => {
      setupRouting({ base: '/base', useHistory: true })

      const el = Router({
        '/': () => html`<p>Home</p>`,
        '/test': () => html`<p>Test</p>`,
      })
      render(el, window.document.body)

      expect(window.document.body.textContent).toBe('Home')

      navigate('/test')

      expect(window.location.pathname).toBe('/base/test')
      expect(window.document.body.textContent).toBe('Test')
    })

    it('should handle relative paths with basePath', () => {
      setupRouting({ base: '/base', useHistory: true })
      const el = Router({
        '/': () => html`<p>Home</p>`,
        '/test': () => html`<p>Test</p>`,
      })
      render(el, window.document.body)

      expect(window.document.body.textContent).toBe('Home')

      navigate('test')

      expect(window.location.pathname).toBe('/base/test')
      expect(window.document.body.textContent).toBe('Test')

      navigate('..')

      expect(window.location.pathname).toBe('/base/')
      expect(window.document.body.textContent).toBe('Home')
    })

    // Yes...this is a highly specific test due to a highly specific bug
    it('should correctly render a nested router that starts on a route with optional segment, and then navigates to base route', () => {
      window.history.pushState({}, '', '/item/42/optionalValue')
      setupRouting({ useHistory: true })
      const el = Router({
        '/': () => html`<div>Home</div>`,
        '/item/*?': () =>
          Router({
            '/': () => html`<div>Item List</div>`,
            '/:id/:optional?': ({ id, optional }) =>
              html`<div>Item ${id}, optional is ${optional}</div>`,
          }),
      })
      render(el, window.document.body)

      expect(window.document.body.textContent).toBe(
        'Item 42, optional is optionalValue'
      )

      navigate('/item')

      expect(window.document.body.textContent).toBe('Item List')
    })
  })
})
