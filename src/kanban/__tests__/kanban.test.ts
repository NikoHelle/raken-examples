import { describe, it, expect } from 'vitest';
import { createTestApp } from '@rakenjs/app';

import { kanbanApp } from '../app-schema';
import { COLUMNS, INITIAL_CARDS, boardViewModel } from '../kanban-maps';
import type { Card, CardsState } from '../kanban-maps';

function app() {
  return createTestApp(kanbanApp());
}

const byGroup = (t: ReturnType<typeof app>) => t.derived<Record<string, readonly Card[]>>('cardsByGroup')!;
const counts = (t: ReturnType<typeof app>) => t.derived<Record<string, number>>('cardsCounts')!;
const exiting = (t: ReturnType<typeof app>) => t.derived<readonly string[]>('cardsExiting')!;
const items = (t: ReturnType<typeof app>) => t.field<Record<string, Card>>('items')!;
/** Column list, defaulting to `[]` — `byGroup`'s index signature is possibly-undefined under strict mode. */
const column = (t: ReturnType<typeof app>, id: string): readonly Card[] => byGroup(t)[id] ?? [];

describe('kanbanApp — seed data', () => {
  it('seeds the four fixed columns from INITIAL_CARDS', () => {
    const t = app();
    expect(Object.keys(byGroup(t))).toEqual([...COLUMNS]);
    expect(counts(t).todo).toBe(2);
    expect(counts(t).doing).toBe(1);
    expect(counts(t).review).toBe(1);
    expect(counts(t).done).toBe(1);
    expect(Object.keys(items(t)).length).toBe(INITIAL_CARDS.length);
    t.dispose();
  });
});

describe('kanbanApp — card CRUD', () => {
  it('cards:add creates a new card in the target column (the event add-card maps to)', () => {
    const t = app();
    t.dispatch('cards:add', { id: 'new-1', group: 'todo', order: 0, title: 'New idea', labels: [], priority: 'low' });

    expect(items(t)['new-1']?.title).toBe('New idea');
    expect(byGroup(t).todo?.some((c) => c.id === 'new-1')).toBe(true);
    expect(counts(t).todo).toBe(3);
    t.dispose();
  });

  it('update-card patches an existing card', () => {
    const t = app();
    t.dispatch('cards:update', { id: 'card-1', patch: { title: 'Renamed', priority: 'high' } });
    expect(items(t)['card-1']?.title).toBe('Renamed');
    expect(items(t)['card-1']?.priority).toBe('high');
    t.dispose();
  });
});

describe('kanbanApp — move', () => {
  it('moves a card cross-column: leaves the source list, appears in the target, counts update', () => {
    const t = app();
    expect(counts(t).todo).toBe(2);
    expect(counts(t).doing).toBe(1);

    t.dispatch('cards:move', { id: 'card-1', group: 'doing', index: 0 });

    expect(column(t, 'todo').map((c) => c.id)).toEqual(['card-2']);
    expect(column(t, 'doing').map((c) => c.id)).toEqual(['card-1', 'card-3']);
    expect(counts(t).todo).toBe(1);
    expect(counts(t).doing).toBe(2);
    expect(items(t)['card-1']?.group).toBe('doing');
    t.dispose();
  });

  it('move to an unknown group is a no-op', () => {
    const t = app();
    t.dispatch('cards:move', { id: 'card-1', group: 'bogus', index: 0 });
    expect(items(t)['card-1']?.group).toBe('todo');
    expect(column(t, 'todo').map((c) => c.id)).toEqual(['card-1', 'card-2']);
    t.dispose();
  });

  it('reorder changes within-column position and reindexes to contiguous order', () => {
    const t = app();
    t.dispatch('cards:reorder', { id: 'card-2', index: 0 });
    expect(column(t, 'todo').map((c) => c.id)).toEqual(['card-2', 'card-1']);
    expect(column(t, 'todo').map((c) => c.order)).toEqual([0, 1]);
    t.dispose();
  });
});

describe('kanbanApp — remove / exit lifecycle', () => {
  it('remove marks exiting (still in byGroup, excluded from counts); dropExited removes it', () => {
    const t = app();
    t.dispatch('cards:remove', 'card-1');

    expect(exiting(t)).toEqual(['card-1']);
    expect(column(t, 'todo').map((c) => c.id)).toEqual(['card-1', 'card-2']); // still rendered
    expect(counts(t).todo).toBe(1); // excludes exiting
    expect(items(t)['card-1']).toBeTruthy(); // not yet deleted

    t.dispatch('cards:dropExited', 'card-1');
    expect(exiting(t)).toEqual([]);
    expect(column(t, 'todo').map((c) => c.id)).toEqual(['card-2']);
    expect(items(t)['card-1']).toBeUndefined();
    t.dispose();
  });

  it('exit-then-re-add: adding the same id again clears it from exiting', () => {
    const t = app();
    t.dispatch('cards:remove', 'card-1');
    expect(exiting(t)).toEqual(['card-1']);

    t.dispatch('cards:add', {
      id: 'card-1',
      group: 'todo',
      order: 0,
      title: 'card-1 again',
      labels: [],
      priority: 'low',
    });
    expect(exiting(t)).toEqual([]);
    expect(items(t)['card-1']?.title).toBe('card-1 again');
    expect(counts(t).todo).toBe(2);
    t.dispose();
  });
});

describe('kanbanApp — filter/search', () => {
  it('empty query: every card matches', () => {
    const t = app();
    const vm = boardViewModel(byGroup(t) as Record<string, readonly Card[]>, counts(t), exiting(t), '');
    for (const col of vm.columns) {
      for (const card of col.cards) {
        expect(card.matches).toBe(true);
      }
    }
    t.dispose();
  });

  it('a query narrows matches: non-matching cards get matches:false, matching stay true', () => {
    const t = app();
    // INITIAL_CARDS has "Design empty states" (todo) among others — filter down to it.
    const vm = boardViewModel(byGroup(t) as Record<string, readonly Card[]>, counts(t), exiting(t), 'design');
    const todo = vm.columns.find((c) => c.id === 'todo')!;
    expect(todo.cards.find((c) => c.id === 'card-1')?.matches).toBe(true); // "Design empty states"
    expect(todo.cards.find((c) => c.id === 'card-2')?.matches).toBe(false); // "Write onboarding copy"
    t.dispose();
  });

  it('matching is case-insensitive', () => {
    const t = app();
    const vm = boardViewModel(byGroup(t) as Record<string, readonly Card[]>, counts(t), exiting(t), 'DESIGN');
    const todo = vm.columns.find((c) => c.id === 'todo')!;
    expect(todo.cards.find((c) => c.id === 'card-1')?.matches).toBe(true);
    t.dispose();
  });

  it('dispatching set-query updates the derived query the Board view reads (ns.board.query mechanism)', () => {
    const t = app();
    expect(t.derived<string>('query')).toBe('');

    t.dispatch('set-query', 'onboarding');
    expect(t.derived<string>('query')).toBe('onboarding');

    const vm = boardViewModel(
      byGroup(t) as Record<string, readonly Card[]>,
      counts(t),
      exiting(t),
      t.derived<string>('query')
    );
    const todo = vm.columns.find((c) => c.id === 'todo')!;
    expect(todo.cards.find((c) => c.id === 'card-1')?.matches).toBe(false); // "Design empty states"
    expect(todo.cards.find((c) => c.id === 'card-2')?.matches).toBe(true); // "Write onboarding copy"
    t.dispose();
  });

  it('clearing the query (set-query "") restores matches:true for every card', () => {
    const t = app();
    t.dispatch('set-query', 'design');
    t.dispatch('set-query', '');
    expect(t.derived<string>('query')).toBe('');

    const vm = boardViewModel(
      byGroup(t) as Record<string, readonly Card[]>,
      counts(t),
      exiting(t),
      t.derived<string>('query')
    );
    for (const col of vm.columns) {
      for (const card of col.cards) {
        expect(card.matches).toBe(true);
      }
    }
    t.dispose();
  });
});

describe('kanbanApp — detail-drawer selection', () => {
  it('select-card sets selectedCard to the full card for the given id', () => {
    const t = app();
    expect(t.derived<Card | null>('selectedCard')).toBeNull();

    t.dispatch('select-card', 'card-3');
    expect(t.derived<Card | null>('selectedCard')?.id).toBe('card-3');
    expect(t.derived<Card | null>('selectedCard')?.title).toBe('Board drag-and-drop');
    t.dispose();
  });

  it('clear-selection nulls selectedCard', () => {
    const t = app();
    t.dispatch('select-card', 'card-3');
    expect(t.derived<Card | null>('selectedCard')).not.toBeNull();

    t.dispatch('clear-selection');
    expect(t.derived<Card | null>('selectedCard')).toBeNull();
    t.dispose();
  });

  it('selecting a different card overwrites the previous selection', () => {
    const t = app();
    t.dispatch('select-card', 'card-1');
    expect(t.derived<Card | null>('selectedCard')?.id).toBe('card-1');

    t.dispatch('select-card', 'card-2');
    expect(t.derived<Card | null>('selectedCard')?.id).toBe('card-2');
    t.dispose();
  });

  it('boardViewModel forwards selectedCard, defaulting to null', () => {
    const t = app();
    const vmClosed = boardViewModel(byGroup(t) as Record<string, readonly Card[]>, counts(t), exiting(t));
    expect(vmClosed.selectedCard).toBeNull();

    t.dispatch('select-card', 'card-5');
    const vmOpen = boardViewModel(
      byGroup(t) as Record<string, readonly Card[]>,
      counts(t),
      exiting(t),
      '',
      t.derived<Card | null>('selectedCard')
    );
    expect(vmOpen.selectedCard?.id).toBe('card-5');
    t.dispose();
  });

  it('a deleted (dropExited) selected card resolves selectedCard back to null', () => {
    const t = app();
    t.dispatch('select-card', 'card-1');
    expect(t.derived<Card | null>('selectedCard')).not.toBeNull();

    t.dispatch('cards:remove', 'card-1');
    t.dispatch('cards:dropExited', 'card-1');
    expect(t.derived<Card | null>('selectedCard')).toBeNull();
    t.dispose();
  });
});

describe('kanbanApp — Board view-model shape', () => {
  it('boardViewModel produces one ColumnVM per fixed column, cards annotated with exiting', () => {
    const t = app();
    t.dispatch('cards:remove', 'card-1');

    const vm = boardViewModel(byGroup(t) as Record<string, readonly Card[]>, counts(t), exiting(t));
    expect(vm.columns.map((c) => c.id)).toEqual([...COLUMNS]);
    const todoColumn = vm.columns.find((c) => c.id === 'todo')!;
    expect(todoColumn.count).toBe(1); // excludes the exiting card-1
    expect(todoColumn.cards.map((c) => c.id)).toEqual(['card-1', 'card-2']); // still rendered
    expect(todoColumn.cards.find((c) => c.id === 'card-1')?.exiting).toBe(true);
    expect(todoColumn.cards.find((c) => c.id === 'card-2')?.exiting).toBe(false);
    t.dispose();
  });

  it('the app’s own Board view (via the schema graph) matches the state', () => {
    const t = app();
    // The view reads/maps are exercised at runtime by a renderer; drive the state and confirm the
    // node exposes the CardsState shape the view derives its props from.
    const state = t.state<CardsState>();
    expect(state?.items['card-1']).toBeTruthy();
    expect(state?.exiting).toEqual([]);
    t.dispose();
  });
});
