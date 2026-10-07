export const RATING_SCORES = [1, 2, 3, 4, 5] as const;
export const RATING_COMMENT_MAX = 500;

const SCORE_WORDS: Record<number, string> = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };

/** "How was your delivery with Speedy?"; the driver card's display name falls back to "Your driver". */
export function ratingPrompt(displayName: string | null | undefined): string {
  const name = displayName?.trim();
  return name && name !== 'Your driver' ? `How was your delivery with ${name}?` : 'How was your delivery?';
}

export function scoreLabel(score: number): string {
  return `${score} ${score === 1 ? 'star' : 'stars'}${SCORE_WORDS[score] ? ` · ${SCORE_WORDS[score]}` : ''}`;
}

/** "★★★★☆" for a stored score. */
export function starsText(score: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

/** Client-side hint only (the backend enforces the same limit). */
export function commentError(comment: string): string | undefined {
  return comment.trim().length > RATING_COMMENT_MAX ? `Keep it under ${RATING_COMMENT_MAX} characters` : undefined;
}
