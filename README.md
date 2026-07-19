# @rakenjs/examples

Renderer-agnostic **example apps** for the [Raken](https://github.com/NikoHelle/raken) family. Each
example is a `@rakenjs/app` schema (state / events / derived / views) — **code only**, no renderer or
`@rakenjs/ui` imports. A renderer playground imports the example's app-def and supplies its own
`ui-views` (plain `@rakenjs/ui`, Tailwind, …), so the app logic is defined once and never drifts
between demos.

Each example is exported under its own subpath, so the collection grows without churn:

| Example | Import | What it shows |
| --- | --- | --- |
| Todo | `@rakenjs/examples/todo` | Root + child node, derived values, event bubbling (`forward`), a controlled input. |
| Signup | `@rakenjs/examples/signup` | Multi-step form (a `step` pointer), pure `validate(values)=>errors`, per-step gating, touched/error display, submit. |

```ts
import { todoApp } from '@rakenjs/examples/todo';
import type { TodoItem, TodoFilter } from '@rakenjs/examples/todo';

// A renderer playground mounts the shared schema with its own view schemas:
mountApp(container, todoApp(), { views: { TodoShell: MyShell, TodoList: MyList } });
```

## Adding an example
1. `src/<name>/` — the `@rakenjs/app` schema + an `index.ts` re-exporting its public surface.
2. Add `"./<name>"` to `exports` in `package.json`.
3. Add a row to the table above.

## Status
Part of the Raken polyrepo (see the meta-workspace's `repos.json`). Currently **not published to
npm** — consumed by the sibling renderer playgrounds via the workspace link; the public repo is here
for reading and cloning.
