/**
 * `@rakenjs/examples/kanban` — the shared, renderer-agnostic Kanban board example (spec Unit D).
 *
 * A `board<Card>({ name: 'cards' })` recipe (`@rakenjs/app`) composed via `createApp(...).tools(...)`;
 * each renderer playground imports `kanbanApp` and supplies its own `ui-views`. MVP scope: board +
 * card CRUD + move — no filter, no detail-drawer (later increments). Nothing here imports a renderer
 * or `@rakenjs/ui`.
 */
export { kanbanApp, BOARD_NAME, cardsActions } from './app-schema';
export { COLUMNS, COLUMN_TITLES, INITIAL_CARDS, kanbanMap, boardViewModel } from './kanban-maps';
export type {
  Card,
  ColumnId,
  Priority,
  CardVM,
  ColumnVM,
  BoardVM,
  CardsState,
  KanbanAction,
} from './kanban-maps';
