import { describe, it, expect, vi } from 'vitest';
import { createTestApp } from '@rakenjs/app';

import type { TodoState } from '../todo-maps';

/** A fresh `app-schema` module instance — what a page reload sees before restoring a snapshot. */
async function freshTodoApp() {
  vi.resetModules();
  const { todoApp } = await import('../app-schema');
  return createTestApp(todoApp());
}

function addTodo(app: Awaited<ReturnType<typeof freshTodoApp>>, text: string) {
  app.dispatch('set-draft', text);
  app.dispatch('add');
}

const ids = (app: Awaited<ReturnType<typeof freshTodoApp>>) => app.state<TodoState>()?.items.map((i) => i.id);

describe('todoApp — ids', () => {
  it('adding after a snapshot restore into a fresh module never repeats an id', async () => {
    const before = await freshTodoApp();
    addTodo(before, 'first');
    const snap = before.snapshot();
    before.dispose();

    const after = await freshTodoApp();
    after.restore(snap);
    addTodo(after, 'second');
    const [a, b] = ids(after) ?? [];
    expect(a).toBeDefined();
    expect(b).not.toBe(a);

    // toggle hits only the targeted item
    after.dispatch('toggle', b);
    expect(after.state<TodoState>()?.items.map((i) => i.done)).toEqual([false, true]);
    after.dispose();
  });

  it('ids are deterministic per app: todo-1, todo-2, …', async () => {
    const app = await freshTodoApp();
    addTodo(app, 'a');
    addTodo(app, 'b');
    expect(ids(app)).toEqual(['todo-1', 'todo-2']);
    app.dispose();

    const other = await freshTodoApp();
    addTodo(other, 'c');
    expect(ids(other)).toEqual(['todo-1']);
    other.dispose();
  });
});
