import { describe, expect, it } from 'vitest';

import { commentError, ratingPrompt, scoreLabel, starsText } from './rating';

describe('ratingPrompt', () => {
  it("names the driver when the backend card has a name", () => {
    expect(ratingPrompt('Speedy')).toBe('How was your delivery with Speedy?');
  });

  it('falls back when there is no real name', () => {
    expect(ratingPrompt('Your driver')).toBe('How was your delivery?');
    expect(ratingPrompt(null)).toBe('How was your delivery?');
    expect(ratingPrompt('  ')).toBe('How was your delivery?');
  });
});

describe('scoreLabel', () => {
  it('reads the score with a word', () => {
    expect(scoreLabel(1)).toBe('1 star · Poor');
    expect(scoreLabel(5)).toBe('5 stars · Excellent');
  });
});

describe('starsText', () => {
  it('draws filled and empty stars, clamped to 0–5', () => {
    expect(starsText(4)).toBe('★★★★☆');
    expect(starsText(5)).toBe('★★★★★');
    expect(starsText(9)).toBe('★★★★★');
    expect(starsText(0)).toBe('☆☆☆☆☆');
  });
});

describe('commentError', () => {
  it('flags comments over 500 characters after trimming', () => {
    expect(commentError('x'.repeat(500))).toBeUndefined();
    expect(commentError(` ${'x'.repeat(500)} `)).toBeUndefined();
    expect(commentError('x'.repeat(501))).toBe('Keep it under 500 characters');
  });
});
