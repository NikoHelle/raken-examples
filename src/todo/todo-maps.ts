/**
 * Todo node type maps — `@rakenjs/app` `defineNode` value-first schema typing for the shared Todo
 * example. Renderer-agnostic: nothing here imports `@rakenjs/ui` or any renderer; a renderer's
 * `ui-views` interprets the `view` refs. Two nodes, matching the runtime schema tree in
 * app-schema.ts: `todoMap` (root) and `todoListMap` (the `list` child) — a worked multi-node example.
 */
import { defineNode, events } from '@rakenjs/app';
import type { AppActionShape } from '@rakenjs/app';

export type TodoItem = {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
};

export type TodoFilter = 'all' | 'active' | 'done';

export type TodoState = {
  readonly items: readonly TodoItem[];
  readonly filter: TodoFilter;
  readonly draft: string;
};

export type TodoCounts = {
  readonly total: number;
  readonly active: number;
  readonly done: number;
};

/** Payload map for the root `Todo` schema's declared events. */
type TodoEvents = {
  add: void;
  toggle: string;
  remove: string;
  'set-filter': TodoFilter;
  'set-draft': string;
};

/** Payload map for the `TodoList` child schema's own declared events (re-dispatched to root — see app-schema.ts). */
type TodoListEvents = {
  toggle: string;
  remove: string;
};

/**
 * Local, renderer-agnostic action shape for this demo's `mapEvents` callbacks — a structural
 * refinement of `AppActionShape` (narrows `identifier` from `unknown` to the demo's actual
 * `string | undefined` carrier). Declared locally (not imported from a renderer bridge) so this
 * schema module never needs a type import from `@rakenjs/wc-renderer` (renderer-agnosticism holds
 * at the type level — the header comment above stays true).
 */
export type TodoAction = {
  readonly type: string;
  readonly identifier?: string;
  readonly payload?: unknown;
};

// Compile-time-only check (mirrors wc-renderer's own `RendererAction satisfies AppActionShape`
// check, src/app/types.ts:41-42): proves `TodoAction` is a valid `toolsForMap` action override. This
// module (unlike the type-only `types.ts`) has real runtime exports, so a `declare const` reference
// would evaluate to `undefined` at import time and throw — a type-only function parameter avoids
// that: `satisfies` is checked against `action`'s declared type at the signature, never called, and
// erased entirely from the emitted JS.
function checkTodoActionSatisfiesAppActionShape(action: TodoAction): void {
  void (action satisfies AppActionShape);
}
void checkTodoActionSatisfiesAppActionShape;

/**
 * Child node map for `TodoList` — reads `root.derived.visibleItems` (the derived tool lives on the
 * ROOT `Todo` node, not this child), typed via its declared `expects.root` claim (spec's worked
 * multi-node example): an unchecked-but-typed claim in Stage 1, verified at runtime by the
 * `verifyNodeMap` drift test (`todo-map-drift.test.ts`) and composition-checked in Stage 3.
 */
export const todoListMap = defineNode({
  views: { TodoList: { items: [] as readonly TodoItem[] } },
  expects: { root: { derived: { visibleItems: [] as readonly TodoItem[] } } },
  events: events<TodoListEvents>(),
});

/**
 * Root node map for `Todo` — state/derived/events/views + the `list` child map composed by value
 * (spec's `children: { list: todoListMap }` pattern).
 */
export const todoMap = defineNode({
  state: { items: [] as TodoItem[], filter: 'all' as TodoFilter, draft: '' as string },
  derived: {
    visibleItems: [] as readonly TodoItem[],
    counts: { total: 0, active: 0, done: 0 } as TodoCounts,
  },
  events: events<TodoEvents>(),
  views: {
    TodoShell: {} as {
      readonly filter: TodoFilter;
      readonly draft: string;
      readonly totalCount: string;
      readonly activeCount: string;
      readonly doneCount: string;
    },
  },
  children: { list: todoListMap },
});

/** Pure filter — kept here (not app-schema.ts) so both the derived compute and tests can share it. */
export function visibleItemsFor(items: readonly TodoItem[], filter: TodoFilter): readonly TodoItem[] {
  if (filter === 'active') return items.filter((item) => !item.done);
  if (filter === 'done') return items.filter((item) => item.done);
  return items;
}

/** Pure counts aggregator — kept here alongside its derived-tool declaration site's map. */
export function countsFor(items: readonly TodoItem[]): TodoCounts {
  const done = items.filter((item) => item.done).length;
  return { total: items.length, active: items.length - done, done };
}

/**
 * Type guard narrowing an arbitrary `string` (as delivered by a `mapEvents` action's `identifier`)
 * to `TodoFilter` — a runtime check, not a cast, so a genuinely malformed identifier is handled
 * rather than silently believed. `ui-views.ts`'s `filterChangeBehavior` only ever emits one of the
 * three literals below, so this always narrows successfully in practice.
 */
export function isTodoFilter(value: string | undefined): value is TodoFilter {
  return value === 'all' || value === 'active' || value === 'done';
}
