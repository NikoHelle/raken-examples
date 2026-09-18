#!/usr/bin/env bash
# Package smoke test (raken#34): pack this package AND its unpublished @rakenjs/app dependency from the
# sibling checkout, install both tarballs into a throwaway project (no workspace symlinks), and import
# the published subpaths under native Node ESM.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${RAKEN_APP_DIR:-$ROOT/../app}"
[ -f "$APP_DIR/package.json" ] || { echo "sibling @rakenjs/app checkout not found at $APP_DIR (set RAKEN_APP_DIR)"; exit 1; }
echo "→ npm pack @rakenjs/app (sibling; prepack builds its dist)"
APP_TARBALL="$(cd "$APP_DIR" && npm pack 2>/dev/null | tail -1)"
echo "→ npm pack @rakenjs/examples"
cd "$ROOT"
TARBALL="$(npm pack 2>/dev/null | tail -1)"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP" "$ROOT/$TARBALL" "$APP_DIR/$APP_TARBALL"; }
trap cleanup EXIT
cd "$TMP" && npm init -y >/dev/null 2>&1
echo "→ installing both tarballs into a fresh project"
npm install --no-audit --no-fund "$APP_DIR/$APP_TARBALL" "$ROOT/$TARBALL" >/dev/null 2>&1
echo "→ importing via package specifiers"
node --input-type=module -e '
  const todo = await import("@rakenjs/examples/todo");
  if (typeof todo.todoApp !== "function") throw new Error("todoApp missing from @rakenjs/examples/todo");
  const signup = await import("@rakenjs/examples/signup");
  const kanban = await import("@rakenjs/examples/kanban");
  if (Object.keys(signup).length === 0 || Object.keys(kanban).length === 0) throw new Error("signup/kanban subpaths empty");
  const { instantiateAppSchema, disposeNode } = await import("@rakenjs/app");
  const root = instantiateAppSchema(todo.todoApp());
  disposeNode(root);
  console.log("✓ smoke OK — @rakenjs/examples/{todo,signup,kanban} resolve and instantiate against the installed @rakenjs/app");
'
