# Solit-html

This package is very much still under development and the API instable. While the core API is unlikely to change, various features are still being added, tweaked, moved, and removed.

Yet another user interface library. Small, simple, signal-based, and sfunctional (OK, so maybe that one doesn't start with S). It's like SolidJS, but with lit-html. "Components" are just functions that setup reactive lit-html templates. State and effects are managed with writable and computed signals that automatically track dependent signals. No JSX, no manual dependency tracking, no rules of hooks, no VDOM, no compiler.

Only three primitives are needed to build reactive components:

- `state(initialValue)` - creates a getter and setter pair for trackable state
  - `urlState(key, initialValue)` - alternatively, creates a state getter and setter pair that syncs with URL search parameters
- `effect(callback)` - runs and ties a side effect to the next created template when it renders
- `html` - a template literal tagging function to build reactive lit-html templates for generating DOM

The returned template results of calling a component can then be rendered with lit-html's `render` function.

```ts
import { urlState, effect, html } from 'solit-html'
import { render } from 'lit-html'

const Counter = () => {
  // State synced with URL search param "count", defaulting to 0 if not present
  const [getCount, setCount] = urlState('count', 0)

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

  // Define an effect (named function not required but helpful for readability)
  effect(function logDoubled() {
    // Tracks dependency `getDoubled` and reruns when it changes
    console.log('doubled:', getDoubled())

    // Runs before the next effect and when the template returned
    // by the Doubled component is removed from the DOM
    return () => {
      console.log('cleaning up doubled effect')
    }
  })

  return html`<p>Double: ${getDoubled}</p>`
}

render(Counter(), document.body)
```

## State

State is created with the `state` and `urlState` functions. Prefer `urlState` for any shareable state that would benefit from being in the URL (think bookmarking and sharing links). These functions return a tuple of a getter and a setter. The getter is a function that returns the current value of the state, and the setter is a function that sets the value of the state. When the state is updated with the setter, any templates or effects that depend on the state will automatically update. To update a template, pass the getter function directly in.

```ts
const [getCount, setCount] = urlState('count', 0)
const [getName, setName] = state('Guest')

return html`<div>
  <p>Hello, ${getName}!</p>
  <p>Count: ${getCount}</p>
  <button @click=${() => setCount(getCount() + 1)}>Increment</button>
  <input 
    type="text" 
    .value=${getName} 
    @input=${(e) => setName(e.target.value)} 
  />
</div>`
```

### Derived state

You can derive state by creating functions that access other state getters. These functions will automatically track their dependencies and update the template when any of the dependencies change. Most of the time this will be sufficient, but when deriving state from other derived state or using derived state in effects, you may want to use memos for better performance and to prevent unnecessary effect reruns. See the [Memos](#memos) section for more details.

```ts
const [getCount, setCount] = urlState('count', 0)
const getDoubled = () => getCount() * 2

return html`<div>
  <p>Count: ${getCount}</p>
  <p>Doubled: ${getDoubled}</p>
  <button @click=${() => setCount(getCount() + 1)}>Increment</button>
</div>`
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

Effects are a way to run side effects in response to changes in state. Declare an effect with the `effect` function. It is similar to the `useEffect` hook in React. All effects will be tied to the next template created with `html` and called when it is rendered. They can optionally return a cleanup function. Whenever their dependencies change, the cleanup function will be called if it exists, and then the effect will be run again. The cleanup function will also be called when the template is removed from the DOM.

Since effects are tied to the next created template, pay mind when creating any sub-templates in your component functions. If you declare an effect and then create a sub-template before returning the main template, the effect will be tied to the sub-template instead of the main template. If that sub-template is conditionally rendered within the main template, the effect will be cleaned up when the sub-template is removed from the DOM.

```ts
const Component = () => {
  effect(() => {
    console.log('sub-template rendered')
    return () => console.log('sub-template removed')
  })
  // Sub-template created before main template, effect tied to this
  const subTemplate = html`<div>Sub-template</div>`
  const [showSubTemplate, setShowSubTemplate] = state(true)

  // Will be tied to the main template
  effect(() => {
    console.log('main template rendered')
    return () => console.log('main template removed')
  })
  
  return html`<div>
    Main template
    <button 
      @click=${() => setShowSubTemplate(!showSubTemplate())}
    >Toggle Sub-template</button>
    ${() => showSubTemplate() && subTemplate}
  </div>`
}
```

## Memos

When you're deriving state inside of templates, you'll typically be fine just using functions. However, if you're using the derived state in effects or other derived state, you may want to memoize the derived state to prevent unnecessary recomputations and effect reruns. You can do this with the `memo` function. The returned getter function will itself be a trackable dependency that is only computed when its value is first accessed and when any of its dependencies change. If the computed value doesn't change, dependent effects and memos won't rerun.

```ts
const [getCount, setCount] = state(0)
const getOnesDigit = memo(() => getCount() % 10)

effect(function logOnesDigit() {
  console.log('Ones digit is', getOnesDigit())
})

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
// Since getArea didn't actually change, it won't update the template
return html`
  <p>Area: ${getArea}</p>
`
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

Solit-html provides a simple router component that can optionally leverage the `history` API, automatically handling anchor clicks to local hrefs. It uses [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) (polyfilled in browsers that don't support it) to match routes. You create a router with the `Router` function, passing in an object of routes to functions that will receive the route parameters as objects of reactive getters. The router will select the most specific route that matches the current URL regardless of order. You can end a route with `*` or `*?` to match all the remaining URL segments, and then nest another Router inside that route to accomplish layouts and subrouting. Each Router establishes a context with the remaining unprocessed URL segments that the following Router will automatically consume.

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

### Memoization cache size

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

### Watching signals outside of components

Most of the time you should be using `effect` inside components which will be cleaned up automatically when the template is removed from the DOM. However, if you need to watch any signals outside of a component, you can use the `watch` function to create a disposable watcher.

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
