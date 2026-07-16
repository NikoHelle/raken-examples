import { describe, it, expect } from 'vitest';
import { createTestApp } from '@rakenjs/app';

import { signupApp } from '../app-schema';
import { validateSignup, stepIsValid, INITIAL_VALUES } from '../signup-maps';
import type { SignupState } from '../signup-maps';

const VALID = { email: 'ada@example.com', password: 'password1', confirm: 'password1', name: 'Ada', plan: 'free' };

describe('validateSignup (pure)', () => {
  it('flags empty/invalid fields; a fully valid form has no errors', () => {
    // email/password/name empty are errors; confirm ('') matches password ('') so it is not.
    expect(Object.keys(validateSignup(INITIAL_VALUES)).sort()).toEqual(['email', 'name', 'password']);
    expect(validateSignup(VALID)).toEqual({});
  });

  it('catches a mismatched confirmation', () => {
    expect(validateSignup({ ...VALID, confirm: 'different' }).confirm).toBeDefined();
  });
});

describe('stepIsValid', () => {
  it('only considers that step’s gated fields', () => {
    const errors = { name: 'required' };
    expect(stepIsValid(0, errors)).toBe(true); // step 0 gates email/password/confirm
    expect(stepIsValid(1, errors)).toBe(false); // step 1 gates name
  });
});

describe('signupApp — behavior', () => {
  it('gates step advance on validity and completes on submit', () => {
    const app = createTestApp(signupApp());
    expect(app.field<number>('step')).toBe(0);
    expect(app.derived<boolean>('canProceed')).toBe(false); // email/password empty

    app.dispatch('next'); // invalid → does not advance
    expect(app.field<number>('step')).toBe(0);

    app.dispatch('set-field', { field: 'email', value: VALID.email });
    app.dispatch('set-field', { field: 'password', value: VALID.password });
    app.dispatch('set-field', { field: 'confirm', value: VALID.confirm });
    expect(app.derived<boolean>('canProceed')).toBe(true);

    app.dispatch('next');
    expect(app.field<number>('step')).toBe(1);
    expect(app.derived<boolean>('canProceed')).toBe(false); // name empty

    app.dispatch('set-field', { field: 'name', value: VALID.name });
    expect(app.derived<boolean>('canProceed')).toBe(true);
    app.dispatch('next');
    expect(app.field<number>('step')).toBe(2);
    expect(app.derived<boolean>('isLastStep')).toBe(true);

    app.dispatch('submit');
    expect(app.field<string>('status')).toBe('done');
    app.dispose();
  });

  it('submitting an invalid form reveals errors and stays editing', () => {
    const app = createTestApp(signupApp());
    app.dispatch('submit');
    expect(app.field<string>('status')).toBe('editing');
    expect(app.state<SignupState>()?.touched.email).toBe(true);
    app.dispose();
  });

  it('back navigates to the previous step without losing values', () => {
    const app = createTestApp(signupApp());
    app.dispatch('set-field', { field: 'email', value: VALID.email });
    app.dispatch('set-field', { field: 'password', value: VALID.password });
    app.dispatch('set-field', { field: 'confirm', value: VALID.confirm });
    app.dispatch('next');
    expect(app.field<number>('step')).toBe(1);
    app.dispatch('back');
    expect(app.field<number>('step')).toBe(0);
    expect(app.state<SignupState>()?.values.email).toBe(VALID.email);
    app.dispose();
  });
});
