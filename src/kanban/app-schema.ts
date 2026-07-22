/**
 * Kanban app schema — `@rakenjs/app` state/derived/views for the shared Kanban example (spec Unit
 * D), authored with the fluent `createApp(node, name)` builder over the `board<Card>` recipe.
 * Renderer-agnostic: nothing here imports `@rakenjs/ui` or any renderer; a renderer's `ui-views`
 * binds the `Board` view. MVP scope: board + card CRUD + move (no filter, no detail-drawer — later
 * increments per the spec).
 *
 * `.tools(board({ name: 'cards', … }))` supplies the real state/events/derived tools; `kanbanMap`
 * (kanban-maps.ts) only mirrors their names so `.view(...)` type-checks against them (recipes add
 * tools outside the node map — see `@rakenjs/app`'s `docs/AI-README.md` §"Typing a `.view` against a
 * recipe's output"). No `.state(...)` call here: the board recipe's own `stateTool` already seeds
 * `{ items, exiting }` from `initial`.
 */
import { createApp, actionShape, board, boardActions } from '@rakenjs/app';
import { kanbanMap, boardViewModel, COLUMNS, INITIAL_CARDS } from './kanban-maps';
import type { Card, KanbanAction } from './kanban-maps';

export type { Card, ColumnId, Priority, CardVM, ColumnVM, BoardVM, CardsState, KanbanAction } from './kanban-maps';
export { COLUMNS, COLUMN_TITLES, INITIAL_CARDS, kanbanMap, boardViewModel } from './kanban-maps';

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

/** Root app schema: `Kanban`. */
export function kanbanApp() {
  return createApp(kanbanMap, 'Kanban', { action: actionShape<KanbanAction>() })
    .tools(board<Card>({ name: BOARD_NAME, groups: COLUMNS, initial: INITIAL_CARDS }))
    .view('Board', {
      reads: ['derived.cardsByGroup', 'derived.cardsCounts', 'derived.cardsExiting'],
      map: ({ cardsByGroup, cardsCounts, cardsExiting }) => boardViewModel(cardsByGroup, cardsCounts, cardsExiting),
      events: {
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
