import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import { cleanCode, isCompleteCode, isPhoneNotVerified, secondsUntil } from './phone-verification';

describe('isPhoneNotVerified', () => {
  it('recognizes only the backend PhoneNotVerified error', () => {
    expect(isPhoneNotVerified(new ApiError(403, 'PhoneNotVerified', 'Verify your phone number to place orders.'))).toBe(true);
    expect(isPhoneNotVerified(new ApiError(403, 'Forbidden', 'No'))).toBe(false);
    expect(isPhoneNotVerified(new Error('PhoneNotVerified'))).toBe(false);
  });
});

describe('codes', () => {
  it('needs exactly six digits, ignoring spaces', () => {
    expect(isCompleteCode('123456')).toBe(true);
    expect(isCompleteCode('123 456')).toBe(true);
    expect(cleanCode(' 12 34 56 ')).toBe('123456');
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('12345a')).toBe(false);
  });
});

describe('secondsUntil', () => {
  const now = Date.parse('2026-10-07T10:00:00.000Z');
  it('counts down whole seconds and never goes negative', () => {
    expect(secondsUntil('2026-10-07T10:01:00.000Z', now)).toBe(60);
    expect(secondsUntil('2026-10-07T10:00:00.400Z', now)).toBe(1);
    expect(secondsUntil('2026-10-07T09:59:00.000Z', now)).toBe(0);
    expect(secondsUntil(null, now)).toBe(0);
    expect(secondsUntil('not a date', now)).toBe(0);
  });
});
