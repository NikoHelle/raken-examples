/**
 * Signup-wizard node type map — `@rakenjs/app` `defineNode` value-first typing for the shared
 * multi-step form example. Renderer-agnostic: nothing here imports `@rakenjs/ui` or any renderer.
 *
 * A single node with a `step` pointer (Account → Profile → Review). Validation follows raken's
 * `form`-recipe pattern: a **pure `validate(values) => errors`** function run in the processor — NOT
 * `validatorTool`, which is a fire-on-change observer that can't clear errors.
 */
import { defineNode, events } from '@rakenjs/app';
import type { AppActionShape } from '@rakenjs/app';

export type Plan = 'free' | 'pro';
export type SignupValues = {
  readonly email: string;
  readonly password: string;
  readonly confirm: string;
  readonly name: string;
  readonly plan: string;
};
export type SignupField = keyof SignupValues;
export type SignupErrors = Partial<Record<SignupField, string>>;
export type SignupTouched = Partial<Record<SignupField, boolean>>;
export type SignupStatus = 'editing' | 'done';

export type SignupState = {
  readonly step: number;
  readonly values: SignupValues;
  readonly errors: SignupErrors;
  readonly touched: SignupTouched;
  readonly status: SignupStatus;
};

/** Step labels, in order. */
export const STEPS = ['Account', 'Profile', 'Review'] as const;

/** The fields each step gates on (Review has none of its own). Index-aligned with {@link STEPS}. */
export const STEP_FIELDS: readonly (readonly SignupField[])[] = [['email', 'password', 'confirm'], ['name'], []];

export const INITIAL_VALUES: SignupValues = { email: '', password: '', confirm: '', name: '', plan: 'free' };

/**
 * Pure values→errors validator (the raken `form`-recipe pattern). Returns an error message per invalid
 * field; an absent key means valid. Called on every field change and re-stored as `state.errors`.
 */
export function validateSignup(v: SignupValues): SignupErrors {
  const e: Record<string, string> = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) e.email = 'Enter a valid email address.';
  if (v.password.length < 8) e.password = 'Use at least 8 characters.';
  if (v.confirm !== v.password) e.confirm = 'Passwords must match.';
  if (v.name.trim() === '') e.name = 'Your name is required.';
  return e;
}

/** True when none of `step`'s gated fields currently carry an error. */
export function stepIsValid(step: number, errors: SignupErrors): boolean {
  return (STEP_FIELDS[step] ?? []).every((f) => errors[f] === undefined);
}

type SignupEvents = {
  'set-field': { field: SignupField; value: string };
  next: void;
  back: void;
  submit: void;
  reset: void;
};

/** Local action shape — narrows `AppActionShape`'s `identifier` to the demo's `string` carrier. */
export type SignupAction = { readonly type: string; readonly identifier?: string; readonly payload?: unknown };
function checkSignupAction(a: SignupAction): void {
  void (a satisfies AppActionShape);
}
void checkSignupAction;

export const signupMap = defineNode({
  state: {
    step: 0 as number,
    values: INITIAL_VALUES,
    errors: {} as SignupErrors,
    touched: {} as SignupTouched,
    status: 'editing' as SignupStatus,
  },
  derived: {
    canProceed: false as boolean,
    isLastStep: false as boolean,
  },
  events: events<SignupEvents>(),
  views: {
    // Flat props (one value/error per field) so a renderer's ui-views can bind each control directly,
    // matching the field-input pattern renderers already use. `*Error` is populated only once the
    // field is touched; `summary` is the review-step recap.
    SignupShell: {} as {
      readonly step: number;
      readonly stepName: string;
      readonly status: SignupStatus;
      readonly canProceed: boolean;
      readonly isLastStep: boolean;
      readonly emailValue: string;
      readonly emailError: string;
      readonly passwordValue: string;
      readonly passwordError: string;
      readonly confirmValue: string;
      readonly confirmError: string;
      readonly nameValue: string;
      readonly nameError: string;
      readonly planValue: string;
      readonly summary: string;
    },
  },
});
