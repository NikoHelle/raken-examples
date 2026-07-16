/**
 * Signup-wizard app schema — authored with `createApp`. Renderer-agnostic; a renderer's `ui-views`
 * binds the `SignupShell` view. One node, a `step` pointer, a pure validator, per-step gating.
 */
import { createApp, actionShape } from '@rakenjs/app';
import { signupMap, validateSignup, stepIsValid, STEP_FIELDS, STEPS, INITIAL_VALUES } from './signup-maps';
import type { SignupField, SignupTouched, SignupAction } from './signup-maps';

function markTouched(touched: SignupTouched, fields: readonly SignupField[]): SignupTouched {
  const next: SignupTouched = { ...touched };
  for (const f of fields) next[f] = true;
  return next;
}

/** A `mapEvents` callback for a field input: carries the typed value as a `set-field` payload. */
function fieldEvent(field: SignupField) {
  return (action: SignupAction) =>
    typeof action.identifier === 'string'
      ? ({ type: 'set-field', payload: { field, value: action.identifier } } as const)
      : undefined;
}

/** Root app schema: `Signup`. */
export function signupApp() {
  return createApp(signupMap, 'Signup', { action: actionShape<SignupAction>() })
    .state({
      step: 0,
      values: INITIAL_VALUES,
      errors: validateSignup(INITIAL_VALUES),
      touched: {},
      status: 'editing',
    })
    .on({
      'set-field': ({ state }, { field, value }) =>
        state?.update((s) => {
          const values = { ...s.values, [field]: value };
          return { ...s, values, errors: validateSignup(values), touched: { ...s.touched, [field]: true } };
        }),
      // Advance only if the current step's fields validate; either way, reveal their errors.
      next: ({ state }) =>
        state?.update((s) => {
          const touched = markTouched(s.touched, STEP_FIELDS[s.step] ?? []);
          if (!stepIsValid(s.step, s.errors)) return { ...s, touched };
          return { ...s, touched, step: Math.min(s.step + 1, STEPS.length - 1) };
        }),
      back: ({ state }) => state?.update((s) => ({ ...s, step: Math.max(s.step - 1, 0) })),
      // Submit: reveal all errors; only finish when the whole form validates.
      submit: ({ state }) =>
        state?.update((s) => {
          const errors = validateSignup(s.values);
          const touched = markTouched(s.touched, Object.keys(s.values) as SignupField[]);
          if (Object.keys(errors).length > 0) return { ...s, touched, errors };
          return { ...s, touched, errors, status: 'done' };
        }),
      reset: ({ state }) =>
        state?.update(() => ({
          step: 0,
          values: INITIAL_VALUES,
          errors: validateSignup(INITIAL_VALUES),
          touched: {},
          status: 'editing',
        })),
    })
    .derived({
      name: 'canProceed',
      inputs: ['state.step', 'state.errors'],
      compute: ({ step, errors }) => stepIsValid(step, errors),
    })
    .derived({ name: 'isLastStep', inputs: ['state.step'], compute: ({ step }) => step === STEPS.length - 1 })
    .view('SignupShell', {
      reads: ['state.step', 'state.values', 'state.errors', 'state.touched', 'state.status', 'derived.canProceed', 'derived.isLastStep'],
      map: ({ step, values, errors, touched, status, canProceed, isLastStep }) => {
        const shownError = (f: SignupField) => (touched[f] ? (errors[f] ?? '') : '');
        return {
          step,
          stepName: STEPS[step] ?? '',
          status,
          canProceed,
          isLastStep,
          emailValue: values.email,
          emailError: shownError('email'),
          passwordValue: values.password,
          passwordError: shownError('password'),
          confirmValue: values.confirm,
          confirmError: shownError('confirm'),
          nameValue: values.name,
          nameError: shownError('name'),
          planValue: values.plan,
          summary: `${values.name || '—'} · ${values.email || '—'} · ${values.plan} plan`,
        };
      },
      events: {
        'email-input': fieldEvent('email'),
        'password-input': fieldEvent('password'),
        'confirm-input': fieldEvent('confirm'),
        'name-input': fieldEvent('name'),
        'plan-change': fieldEvent('plan'),
        'next-click': () => ({ type: 'next' }),
        'back-click': () => ({ type: 'back' }),
        'submit-click': () => ({ type: 'submit' }),
        'reset-click': () => ({ type: 'reset' }),
      },
    })
    .build();
}
