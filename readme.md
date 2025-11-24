# Solit-html

This package is very much still under development and the API instable. While the core API is unlikely to change, various features are still being added, tweaked, moved, and removed.

Yet another user interface library. Small, simple, signal-based, and sfunctional (OK, so maybe that one doesn't start with S). It's like SolidJS, but with lit-html. "Components" are just functions that setup reactive lit-html templates. State and effects are managed with writable and computed signals that automatically track dependent signals. No JSX, no manual dependency tracking, no rules of hooks, no VDOM, no compiler.

Only three primitives are needed to build reactive components:

- `state(initialValue)` - creates a getter and setter pair for trackable state
- `effects(...effectCbs)` - a template directive that ties all provided effect callbacks to the given element
- `html` - a template literal tagging function to build reactive lit-html templates for generating DOM

The returned template results of calling a component can then be rendered with lit-html's `render` function.

```ts
import { state, effects, html } from 'solit-html'
import { render } from 'lit-html'

const Counter = () => {
  const [getCount, setCount] = state(0)

  const increment = () => setCount(getCount() + 1)

  return html`
    <div>
      <!-- Event handlers are automatically batched -->
      <button @click=${increment}>Increment</button>
      <!-- State getters can be passed directly in -->
      <p>Count: ${getCount}</p>
      <!-- Components are just functions that return templates -->
      ${Doubled({ getCount })}
      <!-- Functions are reactive to any state updates inside of them -->
      <p>Triple: ${() => getCount() * 3}</p>
    </div>
  `
}

const Doubled = ({ getCount }: { getCount: () => number }) => {
  // Automatically tracks dependency `getCount`
  const getDoubled = () => getCount() * 2

  // Define an effect
  const logDoubled = () => {
    // Tracks dependency `getDoubled` and reruns when it changes
    console.log('doubled:', getDoubled())

    // Runs before the next effect and when the template returned
    // by the Doubled component is removed from the DOM
    return () => {
      console.log('cleaning up doubled effect')
    }
  }

  // Bind effects to the element
  return html`<p ${effects(logDoubled)}>Double: ${getDoubled}</p>`
}

render(Counter(), document.body)
```

## Templates

Templates are built using a slightly enhanced version of lit-html. The `html` template literal tagging function is used to create a UI template that can be rendered with lit-html's `render` function. [Read more about lit-html here.](https://lit.dev/docs/libraries/standalone-templates/) The tl;dr:

- Write otherwise normal HTML in template literals tagged with `html`
- Use `${}` to interpolate values into the template
- Prefix element properties with `.` to set them as properties instead of attributes e.g. `<button .value=${value}>`
- Prefix event names (without "on") with `@` to set event listeners e.g. `<button @click=${handleClick}>`

The `html` exported from Solit-html adds additional functionality:

- `false` will not render as a text node to make conditional rendering easier (use .toString() if you want to display booleans as text)
- State getters and any functions that access state inside of them will automatically be tracked as dependencies and surgically update the DOM when their values change
- Functions used as event handlers via `@eventname=${someFunction}` will automatically batch state updates so that DOM updates only happen after all state updates are complete.

## Effects

Effects are a way to run side effects in response to changes in signals. They are similar to the `useEffect` hook in React, but since components don't really exist at runtime in Solit-html, they are not bound to a component lifecycle. Instead, they are bound to an element in the template via the `effects` directive.

You can pass in one or more effect callbacks to the `effects` directive, and they will be run in the order they are passed in when the template is rendered. They can optionally return a cleanup function. Whenever their dependencies change, the cleanup function will be called if it exists, and then the effect will be run again. The cleanup function will also be called when the element is removed from the DOM.

## Memos

When you're deriving state inside of templates, you'll typically be fine just using functions. However, if you're using the derived state in effects or other derived state, you may want to memoize the derived state to prevent unnecessary recomputations and effect reruns. You can do this with the `memo` function.

```ts
const [getCount, setCount] = state(0)
const getOnesDigit = memo(() => getCount() % 10)
function logOnesDigit() {
  console.log('Ones digit is', getOnesDigit())
}
setCount(1) // > Ones digit is 1
setCount(11) // No log, ones digit didn't change
```

## Batching state changes

Event handlers and effects automatically batch state changes so that the DOM is only updated after all state changes are complete. You can also manually batch state changes with the `batch` function, such as inside async functions or callbacks that don't originate from DOM events. You can nest batches and they will only flush the DOM updates once at the end of the outermost batch.

```ts
import { batch } from 'solit'

const [getWidth, setWidth] = state(0)
const [getHeight, setHeight] = state(0)
const getArea = memo(() => getWidth() * getHeight())

someConnection.on('flipDimensions', () => {
  batch(() => {
    const currentWidth = getWidth()
    setWidth(getHeight())
    setHeight(currentWidth)
  })
})
// Since getArea didn't actually change, it won't recompute
```

## Context

Context lets you share values deep in the component tree without having to pass props. Create a context stack with `createContext`, optionally providing a default value. Provide a value to a callback's call stack with the `.provide` method on the returned context object. Consume the most recently provided value with the `.value` getter property.

```ts
const themeContext = createContext<() => string>(() => 'light')

const App = () => {
  const [getTheme] = state('dark')
  return themeContext.provide(getTheme, () => {
    return html`${SomeComponent()}`
  })
}

const DeeplyNestedComponent = () => {
  const getTheme = themeContext.value
  return html`
  <div
    class=${() => getTheme() === 'dark' ? 'dark-theme' : 'light-theme'}
  >
    Hello
  </div>`
}
```

## Routing

Solit-html provides a simple router that can optionally leverage the `history` API, automatically handling anchor clicks to local hrefs. It uses URLPattern (polyfilled in browsers that don't support it) to match routes. You create a router with the `Router` function, passing in an object of routes to functions that will receive the route parameters as objects of reactive getters. The router will select the most specific route that matches the current URL regardless of order. You can end a route with `*` or `*?` to match all the remaining URL segments, and then nest another Router inside that route to accomplish layouts and subrouting. Each Router establishes a context with the remaining unprocessed URL segments for the following Router to consume.

 ```ts
setupHistoryRouting({
  base: '/my-app'
})

Router({
  '/': Home,
  '/user/*?': () => html`
    ${Nav()}
    ${Router({
      '/': UsersList,
      '/:id': ({ id }) => UserDetail(id),
      '/me': MyProfile,
    })},
  `,
  '/about': About,
  '*': NotFound,
})
```

## Advanced

These concepts are not needed for basic usage, but are useful to understand how Solit-html works under the hood and to leverage more advanced features.

### Signals

Signals are the underlying state management solution in Solit-html used by `state` and `memo`. You can receive direct access to writable signals created with `signal(initialValue)` and computed signals created with `computed(getter)`. They both have the following common properties and methods:

- `get()` - returns the current value. When used inside of a computed signal's getter, an effect, or a function inside of a template, the signal is automatically tracked as a dependency unless it is called with `false`.
- `value` - a getter property that wraps the `get` method for both computed and writable signals
- `peek` - returns the current value without tracking it as a dependency
- `subscribe(callback)` - subscribes to changes to the current value, returns an unsubscribe function, and immediately calls the callback with the current value
- `observe(callback)` - subscribes to changes to the current value, returns an unsubscribe function, but does not immediately call the callback with the current value
- `unsubscribe(callback)` - unsubscribes a callback from changes to the current value

Writable signals additionally have the following setters and methods:

- `set(value)` - sets the current value
- `value` - a setter property that wraps the `set` method
- `update(updater)` - updates the current value with an updater function that is passed the current value and returns the new value
- `reset()` - resets the current value to the initial value

When passing signals into templates, you can pass either the signal instance itself or its `.get` method. Both will work the same way.

### bind directive

Solit-html provides a `bind` directive to two-way bind an element's attribute or property to a signal. By default it binds to the input event, but you can pass an event name as the second argument to bind to a different event.

```ts
const firstName = signal('')
const isCool = signal(false)

return html`
  <input type="text" .value=${bind(firstName)} />
  <input type="checkbox" .checked=${bind(isCool, 'change')} />
`
```

### Comparing changes

Signals are considered changed using `Object.is` by default. You can override this behavior by passing a custom `hasChanged` option.

```ts
const array = signal([1], {
  hasChanged: (a, b) =>
    a.length !== b.length || a.some((value, i) => value !== b[i]),
})

array.set([1]) // no change
```

### Memoization

Computed signals implement a [LRU cache](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_(LRU)) to memoize previous values based on their dependencies. By default, only the most recent value is cached. You can increase the cache size by passing a `cacheSize` option when creating the computed signal. This is useful for expensive computations that may be called multiple times with the same input values.

Alternatively, if you want to prevent memoization and always recompute values, you can pass `cacheSize: 0`.

```ts
const count = signal(0)
// Stores the last 3 computed values and their dependencies
const doubled = computed(() => count.get() * 2, { cacheSize: 3 })
```

### computedGroup - One calculation, multiple signals

You can use `computedGroup` to create multiple computed signals from a single computation. You can return either an object or an array.

```ts
const {
  red,
  green,
  blue,
} = computedGroup(() => {
  return colorBalls.get().reduce((acc, ball) => {
    acc[ball]++
    return acc
  }, { red: 0, green: 0, blue: 0 })
})

const redCount = red.get()
```

### Destructured methods

All methods are bound to their signal instances, so you can safely destructure them to use independently. This is similar to how `state` works.

```ts
const { get: getValue, set: setValue } = signal('')

return html`<input .value=${getValue} @input=${e => setValue(e.target.value)} />`
```

### Watching signals

Most of the time you should be using effects tied to DOM elements so that they are cleaned up automatically when the element is removed from the DOM. However, if you need to watch any signals outside of an effect, you can use the `watch` function to create a disposable watcher.

```ts
import { signal, watch } from 'solit-html'
const mySignal = signal(0)
const stopWatching = watch(() => {
  console.log('Signal changed:', mySignal.get())
})

// Later, you can stop watching the signal
stopWatching()
```

## Recipes

### Sync with localStorage

```ts
const localStorageSignal = <T>(key: string, initialValue: T) => {
  const storedValue = localStorage.getItem(key)
  const value = storedValue ? JSON.parse(storedValue) : initialValue
  const sig = signal(value)

  sig.subscribe((value) => {
    localStorage.setItem(key, JSON.stringify(value))
  })

  return sig
}
```

### Sync with URLSearchParams

```ts
const urlSearchParamsSignal = (key: string, initialValue: string) => {
  const initialParams = new URLSearchParams(window.location.search)
  const value = initialParams.get(key) ?? initialValue
  const sig = signal(value)

  sig.subscribe((value) => {
    const currentParams = new URLSearchParams(window.location.search)
    currentParams.set(key, value)
    window.history.replaceState({}, '', '?' + currentParams.toString())
  })

  return sig
}
```
