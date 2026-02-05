import { render } from 'lit-html'
import { html } from '../html'
import { Router, setupRouting } from '../Routes'
import { Klondike } from './klondike/Klondike'
import viteConfig from '../../vite-site.config'

const routes = () => {
  setupRouting({ base: viteConfig.base, useHistory: true })

  return Router({
    '/': () => html`<h1>Games!</h1>
      <nav style="display: flex; gap: 16px;">
        <a href="/klondike">Klondike</a>
      </nav>`,
    klondike: Klondike,
  })
}

render(routes(), document.body)
