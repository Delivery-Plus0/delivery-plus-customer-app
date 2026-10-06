import { describe, expect, it } from 'vitest';

import { TILE_SIZE, isValidPosition, projectToPixels, tileUrl, tilesForViewport } from './map-tiles';

const TEMPLATE = 'https://tiles.test/{z}/{x}/{y}.png';

describe('isValidPosition', () => {
  it('accepts real coordinates', () => {
    expect(isValidPosition({ latitude: 30.0444, longitude: 31.2357 })).toBe(true);
    expect(isValidPosition({ latitude: -33.86, longitude: 151.2 })).toBe(true);
    expect(isValidPosition({ latitude: 0, longitude: 0 })).toBe(true);
  });

  it.each([
    null,
    undefined,
    'Cairo',
    {},
    { latitude: 30 },
    { latitude: '30', longitude: '31' },
    { latitude: Number.NaN, longitude: 31 },
    { latitude: 89, longitude: 31 },
    { latitude: 30, longitude: -181 },
  ])('rejects %j', (value) => {
    expect(isValidPosition(value)).toBe(false);
  });
});

describe('projectToPixels', () => {
  it('maps (0, 0) to the centre of the world', () => {
    expect(projectToPixels({ latitude: 0, longitude: 0 }, 0)).toEqual({ x: 128, y: 128 });
    expect(projectToPixels({ latitude: 0, longitude: 0 }, 1)).toEqual({ x: 256, y: 256 });
  });

  it('puts Cairo in the standard OSM tile at zoom 15', () => {
    const { x, y } = projectToPixels({ latitude: 30.0444, longitude: 31.2357 }, 15);
    // Independent check with the OSM wiki formula (tan/sec form): x = 19227, y = 13514 at zoom 15.
    expect(Math.floor(x / TILE_SIZE)).toBe(19227);
    expect(Math.floor(y / TILE_SIZE)).toBe(13514);
  });
});

describe('tileUrl', () => {
  it('fills the template', () => {
    expect(tileUrl(TEMPLATE, 15, 19226, 13537)).toBe('https://tiles.test/15/19226/13537.png');
  });
});

describe('tilesForViewport', () => {
  it('returns nothing before the view has a size', () => {
    expect(tilesForViewport({ latitude: 30, longitude: 31 }, 15, 0, 200, TEMPLATE)).toEqual([]);
  });

  it('covers the whole viewport, with the position exactly at its centre', () => {
    const center = { latitude: 30.0444, longitude: 31.2357 };
    const width = 400;
    const height = 200;
    const tiles = tilesForViewport(center, 15, width, height, TEMPLATE);

    // Every viewport pixel is inside some tile.
    for (const [px, py] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1], [width / 2, height / 2]]) {
      const covering = tiles.filter(
        (t) => px >= t.left && px < t.left + TILE_SIZE && py >= t.top && py < t.top + TILE_SIZE,
      );
      expect(covering.length).toBeGreaterThanOrEqual(1);
    }

    // The tile under the centre is the position's own tile, offset so the position sits at the centre.
    const { x, y } = projectToPixels(center, 15);
    const own = tiles.find((t) => t.key === `15/${Math.floor(x / TILE_SIZE)}/${Math.floor(y / TILE_SIZE)}`);
    expect(own).toBeDefined();
    expect(Math.abs(own!.left + (x % TILE_SIZE) - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(own!.top + (y % TILE_SIZE) - height / 2)).toBeLessThanOrEqual(1);
  });

  it('wraps tile columns across the antimeridian', () => {
    const tiles = tilesForViewport({ latitude: 0, longitude: 179.999 }, 2, 512, 256, TEMPLATE);
    const columns = new Set(tiles.map((t) => t.url.split('/')[4]));
    expect(columns).toContain('0');
    expect(columns).toContain('3');
    for (const t of tiles) expect(Number(t.url.split('/')[4])).toBeLessThan(4);
  });

  it('skips rows beyond the poles', () => {
    const tiles = tilesForViewport({ latitude: 85, longitude: 0 }, 1, 256, 512, TEMPLATE);
    for (const t of tiles) {
      const row = Number(t.url.split('/')[5].replace('.png', ''));
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(2);
    }
  });
});
