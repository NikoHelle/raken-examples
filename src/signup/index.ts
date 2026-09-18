/**
 * `@rakenjs/examples/signup` — the shared, renderer-agnostic multi-step signup form example.
 *
 * A single `@rakenjs/app` node with a `step` pointer and pure values→errors validation; each renderer
 * playground imports `signupApp` and supplies its own `ui-views`. Nothing here imports a renderer.
 */
export { signupApp } from './app-schema.js';
export { signupMap, validateSignup, stepIsValid, STEPS, STEP_FIELDS, INITIAL_VALUES } from './signup-maps.js';
export type {
  Plan,
  SignupValues,
  SignupField,
  SignupErrors,
  SignupTouched,
  SignupStatus,
  SignupState,
  SignupAction,
} from './signup-maps.js';
