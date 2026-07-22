/**
 * Kanban node type maps — `@rakenjs/app` `defineNode` value-first typing for the shared Kanban
 * example (spec Unit D). Renderer-agnostic: nothing here imports `@rakenjs/ui` or any renderer.
 *
 * The board itself is a `board<Card>({ name: 'cards', … })` recipe (`@rakenjs/app`) consumed by
 * `app-schema.ts` via `.tools(board(...))`. Because a recipe adds `state`/`derived`/`events` tools
 * OUTSIDE the node map, `kanbanMap` below MIRRORS the recipe's output names exactly (state
 * `{items,exiting}`; derived `cardsByGroup`/`cardsCounts`/`cardsExiting`; the six board events) — a
 * type contract only (see `@rakenjs/app`'s `docs/AI-README.md` §"Typing a `.view` against a recipe's
 * output"). The recipe supplies the real runtime tools; this map lets `createApp(...).view(...)`
 * type-check against them. **Keep the names in sync with the `board` recipe.**
 */
import { defineNode, events } from '@rakenjs/app';
import type { AppActionShape } from '@rakenjs/app';
import type { BoardItem } from '@rakenjs/app';

export const COLUMNS = ['todo', 'doing', 'review', 'done'] as const;
export type ColumnId = (typeof COLUMNS)[number];

export type Priority = 'low' | 'med' | 'high';

/** The Kanban card shape — a `BoardItem` (id/group/order) plus the demo's own fields. */
export type Card = BoardItem & {
  readonly title: string;
  readonly labels: readonly string[];
  readonly priority: Priority;
};

/** Seed cards — a handful spread across all four columns. */
export const INITIAL_CARDS: readonly Card[] = [
  { id: 'card-1', group: 'todo', order: 0, title: 'Design empty states', labels: ['design'], priority: 'med' },
  { id: 'card-2', group: 'todo', order: 1, title: 'Write onboarding copy', labels: ['content'], priority: 'low' },
  { id: 'card-3', group: 'doing', order: 0, title: 'Board drag-and-drop', labels: ['eng'], priority: 'high' },
  { id: 'card-4', group: 'review', order: 0, title: 'Card exit animation', labels: ['eng', 'motion'], priority: 'med' },
  { id: 'card-5', group: 'done', order: 0, title: 'Kanban spec', labels: ['docs'], priority: 'low' },
];

/** State produced by the `board<Card>({ name: 'cards' })` recipe — a type-contract mirror. */
export type CardsState = {
  readonly items: Record<string, Card>;
  readonly exiting: readonly string[];
};

/** A single card, view-model shaped: `board`'s raw `Card` plus an `exiting` flag for the renderer. */
export type CardVM = Card & { readonly exiting: boolean };

/** One column's view-model: its id/title, the "real" (non-exiting) count, and its ordered cards. */
export type ColumnVM = {
  readonly id: ColumnId;
  readonly title: string;
  readonly count: number;
  readonly cards: readonly CardVM[];
};

/** The `Board` view's props — everything a renderer needs to paint the four columns. */
export type BoardVM = {
  readonly columns: readonly ColumnVM[];
};

/** Human-facing column titles, index-aligned with {@link COLUMNS}. */
export const COLUMN_TITLES: Record<ColumnId, string> = {
  todo: 'To do',
  doing: 'Doing',
  review: 'Review',
  done: 'Done',
};

/**
 * Payload map mirroring the `board<Card>({ name: 'cards' })` recipe's six emitted events
 * (`${name}:${op}`, e.g. `cards:add`) — see `@rakenjs/app`'s `board.ts`/`boardActions`. Kept in sync
 * by name; the recipe is the runtime source of truth.
 */
type CardsEvents = {
  'cards:add': Card;
  'cards:update': { id: string; patch: Partial<Omit<Card, 'id'>> };
  'cards:move': { id: string; group: string; index: number };
  'cards:reorder': { id: string; index: number };
  'cards:remove': string;
  'cards:dropExited': string;
};

/**
 * Local, renderer-agnostic action shape for this demo's `mapEvents` callbacks — a structural
 * refinement of `AppActionShape` (narrows `identifier`/`payload` to what this demo's ui actions
 * actually carry). Declared locally so this schema module never needs a type import from a renderer
 * bridge package (renderer-agnosticism holds at the type level, matching todo/signup).
 */
export type KanbanAction = {
  readonly type: string;
  readonly identifier?: string;
  readonly payload?: unknown;
};

// Compile-time-only check (mirrors todo-maps.ts's own check): proves `KanbanAction` is a valid
// `createApp(...,{action})` override. Type-only reference — erased entirely from emitted JS.
function checkKanbanActionSatisfiesAppActionShape(action: KanbanAction): void {
  void (action satisfies AppActionShape);
}
void checkKanbanActionSatisfiesAppActionShape;

/**
 * Root node map for `Kanban` — mirrors the `board<Card>({ name: 'cards' })` recipe's state/derived/
 * events (type contract only; the recipe supplies the real tools via `.tools(board(...))` in
 * app-schema.ts) plus the `Board` view's own prop contract.
 */
export const kanbanMap = defineNode({
  state: { items: {} as Record<string, Card>, exiting: [] as readonly string[] },
  derived: {
    cardsByGroup: {} as Record<string, readonly Card[]>,
    cardsCounts: {} as Record<string, number>,
    cardsExiting: [] as readonly string[],
  },
  events: events<CardsEvents>(),
  views: {
    Board: {} as BoardVM,
  },
});

/**
 * Builds this demo's `Board` view-model from the board recipe's three deriveds: one {@link ColumnVM}
 * per fixed column (in `COLUMNS` order), each card annotated with an `exiting` flag cross-referenced
 * from `cardsExiting`.
 */
export function boardViewModel(
  byGroup: Record<string, readonly Card[]>,
  counts: Record<string, number>,
  exiting: readonly string[]
): BoardVM {
  const exitingSet = new Set(exiting);
  const columns: ColumnVM[] = COLUMNS.map((id) => ({
    id,
    title: COLUMN_TITLES[id],
    count: counts[id] ?? 0,
    cards: (byGroup[id] ?? []).map((card) => ({ ...card, exiting: exitingSet.has(card.id) })),
  }));
  return { columns };
}
