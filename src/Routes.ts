import { HTMLTemplateResult, nothing } from 'lit-html'
import { signal } from './signals/Signal'
import { computed } from './signals/ComputedSignal'
import { URLPattern } from 'urlpattern-polyfill'
import { createContext } from './context'
import { ReactiveGetter } from './types'
import { memoGroup } from './computedGroup'

// @ts-ignore
globalThis.URLPattern ??= URLPattern

type ParamIfRequired<T> = T extends `${string}?` ? never : T
type ParamIfOptional<T> = T extends `${infer Param}?` ? Param : never

// type for extracting params from path
type PathParams<T extends string | number | symbol> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? ParamIfRequired<Param> | PathParams<Rest>
    : T extends `${string}:${infer Param}`
    ? ParamIfRequired<Param>
    : never

type OptionalPathParams<T extends string | number | symbol> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? ParamIfOptional<Param> | OptionalPathParams<Rest>
    : T extends `${string}:${infer Param}`
    ? ParamIfOptional<Param>
    : never

type ParamMap<T extends string> = {
  [K in PathParams<T>]: ReactiveGetter<string>
} & {
  [K in OptionalPathParams<T>]: ReactiveGetter<string | undefined>
}

type RouteMap<T> = {
  [K in keyof T & string]: T[K] extends (
    props: ParamMap<K>
  ) => HTMLTemplateResult
    ? (props: ParamMap<K>) => HTMLTemplateResult
    : never
}

// TODO better type checking to prevent invalid routes
// TODO Way to load data before returning for SSR?
// TODO types for modifiers * and +
// TODO use computed signals for params
// TODO escape input to navigate?
// TODO lots of error handling for unhappy paths

const currentPath = signal(window.location.hash.slice(1))
const setPath = (path: string) => {
  currentPath.set(path)
}

let historyRouting = false
let basePath = ''
export const setupHistoryRouting = ({ base }: { base?: string } = {}) => {
  basePath = base ?? ''
  if (basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1)
  }
  historyRouting = true
  let initialPath = window.location.pathname
  if (initialPath.startsWith(basePath)) {
    initialPath = initialPath.slice(basePath.length)
  }
  setPath(initialPath)
}

window.addEventListener('click', (e) => {
  if (
    e.target instanceof HTMLAnchorElement &&
    e.target.href.startsWith(window.location.origin)
  ) {
    e.preventDefault()
    if (historyRouting) {
      window.history.pushState({}, '', e.target.href)
    } else {
      window.location.hash = e.target.pathname
    }

    setPath(e.target.pathname)
  }
})
window.addEventListener('popstate', () => {
  setPath(
    historyRouting ? window.location.pathname : window.location.hash.slice(1)
  )
})

export const navigate = (path: string) => {
  if (historyRouting) {
    let logicalPath = currentPath.get() || '/'
    if (!logicalPath.startsWith('/')) logicalPath = '/' + logicalPath

    let targetPath: string
    if (path.startsWith('/')) {
      targetPath = basePath + path
    } else {
      let base = window.location.origin + basePath + logicalPath
      if (!base.endsWith('/')) base += '/'
      const url = new URL(path, base)
      targetPath = url.pathname + url.search + url.hash
    }

    // Normalize: remove trailing slash except for root or basePath root
    if (
      targetPath.length > 1 &&
      targetPath.endsWith('/') &&
      (!basePath || targetPath !== basePath + '/')
    ) {
      targetPath = targetPath.slice(0, -1)
    }
    // Always ensure trailing slash for root with basePath
    if (basePath && (targetPath === basePath || targetPath === basePath + '')) {
      targetPath = basePath + '/'
    }

    window.history.pushState({}, '', targetPath)

    let newLogicalPath = targetPath
    if (basePath && newLogicalPath.startsWith(basePath)) {
      newLogicalPath = newLogicalPath.slice(basePath.length)
    }
    setPath(newLogicalPath || '/')
  } else {
    const fullUrl = new URL(path, window.location.origin + window.location.hash)
    window.location.hash = fullUrl.pathname + fullUrl.search
    setPath(fullUrl.pathname)
  }
}

const isStaticSegment = (segment: string) =>
  !segment.startsWith(':') && segment !== '*'

const compareSegments = (a: string[], b: string[], index = 0) => {
  if (index === a.length) {
    return b.at(-1)!.length - a.at(-1)!.length
  }
  const aSegmentStatic = isStaticSegment(a[index] ?? '')
  const bSegmentStatic = isStaticSegment(b[index] ?? '')

  if (aSegmentStatic === bSegmentStatic) {
    return compareSegments(a, b, index + 1)
  }
  return aSegmentStatic ? -1 : 1
}

const sortPaths = (paths: string[]) =>
  paths.sort((a, b) => {
    const aParts = a.split('/')
    const bParts = b.split('/')
    if (aParts.length !== bParts.length) {
      return bParts.length - aParts.length
    }
    return compareSegments(aParts, bParts)
  })

const remainingPathContext = createContext<ReactiveGetter<string | undefined>>(
  currentPath.get
)

/**
 * Router component for choosing a route based on the provided path.
 *
 * First argument is an object of keys representing the path to match, and values representing the component to render.
 *
 * Uses [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)
 * to handle path matching. Passes the groups from the match to the component as an object
 * of reactive getters.
 *
 * tl;dr:
 * - `''` matches an empty segment (i.e. the index), slash or no slash
 * - `'*'` matches everything (slash required, else '*?' makes the slash optional), passing an object with the key `0` as a reactive getter with the value of the matched path.
 * - `':param'` matches a route segment if present and passes an object with the key `param` as a reactive getter with the value of the matched param.
 * - `':param?'` matches a route segment, present or not, and passes an object with the key `param` as a reactive getter with the value of the matched param, or undefined if not present.
 *
 * The second argument defaults to the current remaining path context reactive getter used by the router navigation functions. You can optionally
 * pass a different reactive getter, e.g. selected tab state, to match against.
 *
 * @example
 *
 * ```ts
 * Router({
 *   '': Home,
 *   'user/*?': () =>
 *     Router({
 *       '': UsersList,
 *       ':id': ({ id }) => UserDetail(id),
 *       'me': MyProfile,
 *     }),
 *  'about': About,
 *  '*': NotFound,
 * })
 * ```
 *
 * @param routes An object of keys representing the path to match, and values representing the component to render.
 * @param path The path to match against.
 * @returns The component whose path matches the provided path.
 */
export const Router = <K, T extends RouteMap<K>>(
  routes: T,
  path = remainingPathContext.value ?? ''
) => {
  const activePath = computed(() => {
    const pathValue = path() ?? ''
    const formattedPath = `${pathValue.startsWith('/') ? '' : '/'}${pathValue}`

    const matchedPath = sortPaths(Object.keys(routes)).find((route) => {
      const formattedRoute = `${route.startsWith('/') ? '' : '/'}${route}`
      const pattern = new URLPattern({
        pathname: formattedRoute,
      })
      return !!pattern.exec({ pathname: formattedPath })
    }) as keyof T | undefined

    return matchedPath
  })

  const params = memoGroup(() => {
    const formattedPath = `${path()?.startsWith('/') ? '' : '/'}${path() ?? ''}`

    const active = activePath.get() as string | undefined
    if (!active) return {}
    const pattern = new URLPattern({
      pathname: active.startsWith('/') ? active : `/${active}`,
    })
    const match = pattern.exec({ pathname: formattedPath })
    return match ? match.pathname.groups : {}
  })

  Object.values(params).forEach((getter) => {
    getter(false) // initialize, since they're lazy
  })

  return computed(() =>
    remainingPathContext.provide(
      params[0],
      () => routes[activePath.get() ?? '']?.(params) ?? nothing
    )
  )
}
