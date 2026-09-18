/**
 * `@rakenjs/examples/todo` — the shared, renderer-agnostic Todo example app.
 *
 * The single source of truth for the demo's `@rakenjs/app` schema (state/events/derived/views);
 * each renderer playground imports `todoApp` and supplies its own `ui-views` (plain `@rakenjs/ui`,
 * Tailwind, …). Nothing here imports a renderer or `@rakenjs/ui`.
 */
export { todoApp } from './app-schema.js';
export { todoMap, todoListMap, visibleItemsFor, countsFor, isTodoFilter } from './todo-maps.js';
export type { TodoItem, TodoFilter, TodoState, TodoCounts, TodoAction } from './todo-maps.js';
