/**
 * Todo app schema — `@rakenjs/app` state/events/derived/views for the shared Todo example, authored
 * with the fluent `createApp(node, name)` builder. Renderer-agnostic: nothing here imports
 * `@rakenjs/ui` or any renderer; each renderer's `ui-views` binds the `view` names to ui schemas.
 *
 * `createApp(node)` treats the value-first `defineNode` shape (todo-maps.ts) as the types-first setup
 * phase, then every chain method is typed off it and compiles down to the same tool descriptors the
 * `toolsForNode` + `pipe` form produced — identical `.graph` and serialization (see the builder's
 * golden-equivalence test in `@rakenjs/app`). `.on(...)` derives event `emits` from the handler keys;
 * `.forward(...)` is the child→root bubbling shim.
 */
import { createApp, actionShape } from '@rakenjs/app';
import { todoMap, todoListMap, visibleItemsFor, countsFor, isTodoFilter } from './todo-maps.js';
import type { TodoAction } from './todo-maps.js';

export type { TodoItem, TodoFilter, TodoState, TodoCounts, TodoAction } from './todo-maps.js';

let nextId = 0;
/** Monotonic id generator — swapped for a real id source (uuid, server) outside a demo. */
function createId(): string {
  nextId += 1;
  return `todo-${nextId}`;
}

/** Root app schema: `Todo` (with its `list` child). */
export function todoApp() {
  return createApp(todoMap, 'Todo', { action: actionShape<TodoAction>() })
    .state({ items: [], filter: 'all', draft: '' })
    // `on(...)` = the node's events + processor in one site; `emits` is derived from these keys.
    .on({
      add: ({ state }) =>
        state?.update((s) => {
          const text = s.draft.trim();
          if (text === '') return s;
          const item = { id: createId(), text, done: false };
          return { ...s, items: [...s.items, item], draft: '' };
        }),
      toggle: ({ state }, id) =>
        state?.update((s) => ({
          ...s,
          items: s.items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
        })),
      remove: ({ state }, id) => state?.update((s) => ({ ...s, items: s.items.filter((item) => item.id !== id) })),
      'set-filter': ({ state }, filter) => state?.update((s) => ({ ...s, filter })),
      'set-draft': ({ state }, draft) => state?.update((s) => ({ ...s, draft })),
    })
    .derived({
      name: 'visibleItems',
      inputs: ['state.items', 'state.filter'],
      compute: ({ items, filter }) => visibleItemsFor(items, filter),
    })
    .derived({ name: 'counts', inputs: ['state.items'], compute: ({ items }) => countsFor(items) })
    .view('TodoShell', {
      reads: ['derived.counts', 'state.filter', 'state.draft'],
      map: ({ counts, filter, draft }) => ({
        filter,
        draft,
        totalCount: `Total: ${counts.total}`,
        activeCount: `Active: ${counts.active}`,
        doneCount: `Done: ${counts.done}`,
      }),
      events: {
        'draft-input': (action) =>
          typeof action.identifier === 'string' ? { type: 'set-draft', payload: action.identifier } : undefined,
        'add-submit': () => ({ type: 'add' }),
        'filter-change': (action) => {
          const value = action.identifier;
          return isTodoFilter(value) ? { type: 'set-filter', payload: value } : undefined;
        },
      },
    })
    // Child `TodoList` reads the ROOT's `visibleItems` derived and mounts into TodoShell's `list` slot.
    // `forward(...)` declares toggle/remove on the child and re-dispatches them to the root (bubbling).
    .child(
      'list',
      createApp(todoListMap, 'TodoList', { action: actionShape<TodoAction>() })
        .state({})
        .forward(['toggle', 'remove'], 'root')
        .view('TodoList', {
          reads: ['root.derived.visibleItems'],
          map: ({ visibleItems }) => ({ items: visibleItems }),
          events: {
            toggle: (action) =>
              typeof action.identifier === 'string' ? { type: 'toggle', payload: action.identifier } : undefined,
            remove: (action) =>
              typeof action.identifier === 'string' ? { type: 'remove', payload: action.identifier } : undefined,
          },
          slot: 'list',
        })
    )
    .build();
}
