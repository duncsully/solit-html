import { state } from './signals/Signal'

/**
 * Creates reactive state synchronized with URL parameters.
 * @param key The URL parameter key
 * @param defaultValue The default value if the URL parameter is not set or invalid
 * @returns A tuple of the value getter and a setter functions
 * @example
 * ```ts
 * const [getSearch, setSearch] = urlState('search', '')
 * ```
 */
export const urlState = <T>(key: string, defaultValue: T) => {
  const params = new URLSearchParams(window.location.search)
  let parsedValue: T
  try {
    parsedValue = JSON.parse(params.get(key) || '') as T
  } catch {
    parsedValue = defaultValue
  }
  const [value, setValue] = state(parsedValue)

  // Update the URL when the state changes
  const setter = (newValue: T) => {
    setValue(newValue)
    // Use the current URLSearchParams to avoid overwriting other params
    const params = new URLSearchParams(window.location.search)
    params.set(key, JSON.stringify(newValue))
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
  }

  return [value, setter] as const
}
