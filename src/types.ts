/**
 * A function that returns a value of type T, and will be automatically tracked
 * as a dependency by any reactive system (e.g. memos, effects, templates) when
 * called, unless `false` is passed.
 */
export type ReactiveGetter<T> = (track?: boolean) => T
