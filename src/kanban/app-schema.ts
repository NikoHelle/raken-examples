/**
 * Kanban app schema — `@rakenjs/app` state/derived/views for the shared Kanban example (spec Unit
 * D), authored with the fluent `createApp(node, name)` builder over the `board<Card>` recipe.
 * Renderer-agnostic: nothing here imports `@rakenjs/ui` or any renderer; a renderer's `ui-views`
 * binds the `Board` view. Scope: board + card CRUD + move + filter/search + a detail-drawer selection
 * (the final increment per the spec — labels/priority display + the drawer itself are the
 * playground's job; this schema only tracks WHICH card is selected).
 *
 * `.tools([...board({ name: 'cards', … }), namespacedStateTool(...)])` supplies the real
 * state/events/derived tools; `kanbanMap` (kanban-maps.ts) only mirrors their names so `.view(...)`
 * type-checks against them (recipes add tools outside the node map — see `@rakenjs/app`'s
 * `docs/AI-README.md` §"Typing a `.view` against a recipe's output"). No `.state(...)` call here: the
 * board recipe's own `stateTool` already seeds `{ items, exiting }` from `initial`.
 *
 * Filter/search's `query` AND the drawer's `selectedId` both live in the SAME `ui` namespaced-state
 * tool (not the board's `stateTool` — a node allows only one regular `stateTool`) — see the
 * `UI_NAMESPACE` doc comment below for the full mechanism + why it was chosen over `composeRecipes`.
 */
import { createApp, actionShape, board, boardActions, namespacedStateTool, derivedTool, processorTool } from '@rakenjs/app';
import { kanbanMap, boardViewModel, COLUMNS, INITIAL_CARDS } from './kanban-maps.js';
import type { Card, KanbanAction } from './kanban-maps.js';

export type { Card, ColumnId, Priority, CardVM, ColumnVM, BoardVM, CardsState, KanbanAction } from './kanban-maps.js';
export { COLUMNS, COLUMN_TITLES, INITIAL_CARDS, kanbanMap, boardViewModel } from './kanban-maps.js';

/** Board name used for the `board<Card>` recipe — event types are `cards:add`, `cards:move`, etc. */
export const BOARD_NAME = 'cards';

/** Re-exported action builders for the `cards` board — convenient for tests/playgrounds. */
export const cardsActions = boardActions<Card>(BOARD_NAME);

let nextId = 0;
/** Monotonic id generator — swapped for a real id source (uuid, server) outside a demo. */
function createId(): string {
  nextId += 1;
  return `card-new-${nextId}`;
}

/** Reads a ui action's `identifier` as a plain string, else `undefined` (a runtime narrow, not a cast). */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Filter/search + detail-drawer state's home: a `ui` namespace (`namespacedStateTool`), NOT the board
 * recipe's `stateTool` — a node allows only one regular `stateTool`, and that one is already the
 * `board` recipe's `{ items, exiting }` (named `cards`). `{ board: { query: '', selectedId: null } }`
 * — `selectedId` is a sibling field in the SAME `board` namespace entry as `query` (both are
 * board-scoped ui state), not a second namespace. See `kanban-maps.ts`'s `UiState` doc comment for the
 * full mechanism writeup + why a plain `derivedTool`/`.view` `reads` CAN read it declaratively via
 * `ns.board.query`/`ns.board.selectedId`.
 */
const UI_NAMESPACE = 'ui';

/**
 * The board recipe's own processor tool name (`${BOARD_NAME}Processor` — see `@rakenjs/app`'s
 * `board.ts`). A node also allows only one EVENT tool total (a harder ceiling than the state-tool
 * one — `instantiate.ts` throws unconditionally past one, since `eventTool` has no `append`/merge
 * unlike `processorTool`/`namespacedStateTool`), so `.on(...)`'s sugar (which creates a SECOND event
 * tool) can't be used here — the board recipe's `cardsEvents` tool is already the node's one event
 * tool. `set-query` is dispatched (and handled below) without its own declared `emits` entry; the
 * schema-validator's `unhandled-event`/`unknown-trigger` checks for that are warn-severity only (see
 * `@rakenjs/app`'s validate.ts), so this is a tolerated, documented gap — matching the codebase's own
 * standard (`createTestApp`'s `assertValid` defaults to `false`). The processor handler is appended to
 * the board's EXISTING processor tool by matching its name exactly, so `pipe()`'s same-name merge
 * (processorTool supports `append`) folds it in instead of erroring on a second processor.
 */
const BOARD_PROCESSOR_NAME = `${BOARD_NAME}Processor`;

/** Root app schema: `Kanban`. */
export function kanbanApp() {
  return createApp(kanbanMap, 'Kanban', { action: actionShape<KanbanAction>() })
    .tools([
      ...board<Card>({ name: BOARD_NAME, groups: COLUMNS, initial: INITIAL_CARDS }),
      namespacedStateTool({ name: UI_NAMESPACE, states: { board: { query: '', selectedId: null } } }),
    ])
    .tool(
      derivedTool({
        name: 'query',
        inputs: ['ns.board.query'],
        compute: (i) => (i as { query?: string }).query ?? '',
      })
    )
    .tool(
      // The full selected `Card` (or `null`) the drawer renders — resolves `ns.board.selectedId`
      // against the board recipe's own `state.items` map. Reads BOTH `state.items` (so the derived
      // recomputes when the selected card itself is edited/removed, not just on selection change) and
      // `ns.board.selectedId` — same two-input-path shape `query` uses for its one input, extended to
      // two. A `selectedId` that no longer exists in `items` (e.g. the selected card was deleted)
      // resolves to `null` — the drawer closes itself rather than showing a stale/missing card.
      derivedTool({
        name: 'selectedCard',
        inputs: ['state.items', 'ns.board.selectedId'],
        compute: (i) => {
          const { items, selectedId } = i as { items?: Record<string, Card>; selectedId?: string | null };
          if (!selectedId) return null;
          return items?.[selectedId] ?? null;
        },
      })
    )
    .tool(
      processorTool({
        name: BOARD_PROCESSOR_NAME,
        // Filter/search: sets the ui-namespaced query the Board view-model derives `matches` from.
        // `ctx.ns('board')` — 'board' is the NAMESPACE key (this tool's `states: { board: {...} }`),
        // not the namespacedStateTool's own `name` ('ui', used only for multi-instance disambiguation).
        handles: {
          'set-query': (ctx, payload) => ctx.ns('board')?.update({ query: payload as string }),
          // Detail-drawer: select/clear which card's id the `selectedCard` derived resolves.
          'select-card': (ctx, payload) => ctx.ns('board')?.update({ selectedId: payload as string }),
          'clear-selection': (ctx) => ctx.ns('board')?.update({ selectedId: null }),
        },
      })
    )
    .view('Board', {
      // Reads `derived.query`/`derived.selectedCard` (both `derivedTool`s above, themselves reading
      // `ns.board.*`) rather than the namespaced path directly: `NodePath<M>`'s typed checker has no
      // `ns.*` member yet, and mixing an `asPath(...)` escape-hatch entry into a `reads` array breaks
      // `InputsObjectM`'s last-segment key inference for ALL entries (a real friction point found while
      // wiring this up — `LastSegment<DynamicPath>` doesn't reduce to a literal key). Routing through a
      // named `derivedTool` keeps every `reads` entry a checked literal path.
      reads: [
        'derived.cardsByGroup',
        'derived.cardsCounts',
        'derived.cardsExiting',
        'derived.query',
        'derived.selectedCard',
      ],
      map: ({ cardsByGroup, cardsCounts, cardsExiting, query, selectedCard }) =>
        boardViewModel(cardsByGroup, cardsCounts, cardsExiting, query, selectedCard),
      events: {
        // Filter/search ui-action: the search input's live value. `@rakenjs/ui/actions`' `onInput`
        // carries a plain input's value as `identifier` (never `payload`) — same convention the
        // `todo` app-def's `draft-input` handler reads (`action.identifier`), so no new local action
        // factory is needed here (unlike `add-card`'s form submit, which genuinely needs a payload).
        'filter-change': (action) => {
          const query = asString(action.identifier) ?? '';
          return { type: 'set-query', payload: query };
        },
        // Detail-drawer: a card body click carries the card's id as `identifier` (see the playground's
        // `card-click` behavior — a click on the card MINUS its delete button, which stops
        // propagation). Selecting the same card again (or a different one) simply overwrites
        // `selectedId`; there's no toggle-to-close-on-repeat-click in this MVP.
        'card-click': (action) => {
          const id = asString(action.identifier);
          return id === undefined ? undefined : { type: 'select-card', payload: id };
        },
        // Detail-drawer: the close button or Escape closes the drawer.
        'drawer-close': () => ({ type: 'clear-selection' }),
        // Add a new card to a column: identifier carries the target column id, payload the title.
        'add-card': (action) => {
          const group = asString(action.identifier);
          const title = typeof action.payload === 'string' ? action.payload : '';
          if (group === undefined) return undefined;
          const card: Card = { id: createId(), group, order: 0, title, labels: [], priority: 'med' };
          return { type: 'cards:add', payload: card };
        },
        // A drop (drag or keyboard) resolved to a target column + index by the renderer's dnd bridge.
        'card-dropped': (action) => {
          const drop = action.payload as { id?: string; group?: string; index?: number } | undefined;
          if (!drop || typeof drop.id !== 'string' || typeof drop.group !== 'string' || typeof drop.index !== 'number') {
            return undefined;
          }
          return { type: 'cards:move', payload: { id: drop.id, group: drop.group, index: drop.index } };
        },
        // Reorder within the current column (e.g. keyboard arrow-reorder).
        'card-reordered': (action) => {
          const reorder = action.payload as { id?: string; index?: number } | undefined;
          if (!reorder || typeof reorder.id !== 'string' || typeof reorder.index !== 'number') return undefined;
          return { type: 'cards:reorder', payload: { id: reorder.id, index: reorder.index } };
        },
        // Edit a card's fields (title/labels/priority) — identifier is the card id, payload the patch.
        'update-card': (action) => {
          const id = asString(action.identifier);
          const patch = action.payload as Partial<Omit<Card, 'id'>> | undefined;
          if (id === undefined || !patch) return undefined;
          return { type: 'cards:update', payload: { id, patch } };
        },
        // Soft-delete: marks the card exiting so the renderer can play its exit animation.
        'remove-card': (action) => {
          const id = asString(action.identifier);
          return id === undefined ? undefined : { type: 'cards:remove', payload: id };
        },
        // Finalize a prior remove once the exit animation's `transitionend` fires.
        'card-exited': (action) => {
          const id = asString(action.identifier);
          return id === undefined ? undefined : { type: 'cards:dropExited', payload: id };
        },
      },
    })
    .build();
}
