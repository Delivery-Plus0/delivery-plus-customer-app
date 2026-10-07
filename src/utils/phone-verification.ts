import { ApiError } from '@/services/api';

/** The backend's error code when an action needs a verified phone (#153). */
export const PHONE_NOT_VERIFIED = 'PhoneNotVerified';

export function isPhoneNotVerified(error: unknown): boolean {
  return error instanceof ApiError && error.error === PHONE_NOT_VERIFIED;
}

/** Codes are the six digits from the text message; spaces from pasting are ignored. */
export function cleanCode(input: string): string {
  return input.replace(/\s/g, '');
}

export function isCompleteCode(input: string): boolean {
  return /^\d{6}$/.test(cleanCode(input));
}

/** Whole seconds left until `iso`, never negative; 0 when unknown. */
export function secondsUntil(iso: string | null | undefined, now: number = Date.now()): number {
  if (!iso) return 0;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? 0 : Math.max(0, Math.ceil((at - now) / 1000));
}
