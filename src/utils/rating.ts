import { t } from '@/i18n/core';
export const RATING_SCORES = [1, 2, 3, 4, 5] as const;
export const RATING_COMMENT_MAX = 500;

function scoreWord(score: number): string | null {
  switch (score) {
    case 1:
      return t('Poor');
    case 2:
      return t('Fair');
    case 3:
      return t('Good');
    case 4:
      return t('Very good');
    case 5:
      return t('Excellent');
    default:
      return null;
  }
}

/** "How was your delivery with Speedy?"; the driver card's display name falls back to "Your driver". */
export function ratingPrompt(displayName: string | null | undefined): string {
  const name = displayName?.trim();
  return name && name !== 'Your driver' ? t('How was your delivery with {name}?', { name }) : t('How was your delivery?');
}

export function scoreLabel(score: number): string {
  const stars = score === 1 ? t('1 star') : t('{n} stars', { n: score });
  const word = scoreWord(score);
  return word ? `${stars} · ${word}` : stars;
}

/** "★★★★☆" for a stored score. */
export function starsText(score: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

/** Client-side hint only (the backend enforces the same limit). */
export function commentError(comment: string): string | undefined {
  return comment.trim().length > RATING_COMMENT_MAX ? t('Keep it under {max} characters', { max: RATING_COMMENT_MAX }) : undefined;
}
