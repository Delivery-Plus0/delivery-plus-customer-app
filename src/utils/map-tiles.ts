/** Standard web-map (slippy map) tiles: 256 px squares in the Web Mercator projection. */
export const TILE_SIZE = 256;

/** Web Mercator can't show the poles; latitudes beyond this are not a usable position. */
const MAX_LATITUDE = 85.05112878;

export type LatLng = { latitude: number; longitude: number };

/** A position the map can actually show: finite numbers inside the projection's range. */
export function isValidPosition(position: unknown): position is LatLng {
  if (!position || typeof position !== 'object') return false;
  const { latitude, longitude } = position as Record<string, unknown>;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= MAX_LATITUDE &&
    Math.abs(longitude) <= 180
  );
}

/** Global pixel coordinates of a position at a zoom level (the whole world is 256·2^zoom px wide). */
export function projectToPixels({ latitude, longitude }: LatLng, zoom: number): { x: number; y: number } {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  };
}

export function tileUrl(template: string, zoom: number, x: number, y: number): string {
  return template.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y));
}

export type PlacedTile = {
  key: string;
  url: string;
  /** Offset of the tile's top-left corner inside the viewport, in px. */
  left: number;
  top: number;
};

/**
 * The tiles covering a `width`×`height` viewport centred on `center`, each with its offset inside
 * the viewport. The centre is therefore always at (width/2, height/2), where the marker goes.
 * Longitude wraps around the antimeridian; rows beyond the poles are skipped.
 */
export function tilesForViewport(
  center: LatLng,
  zoom: number,
  width: number,
  height: number,
  template: string,
): PlacedTile[] {
  if (width <= 0 || height <= 0) return [];
  const tilesPerSide = 2 ** zoom;
  const { x, y } = projectToPixels(center, zoom);
  const originX = x - width / 2;
  const originY = y - height / 2;

  const tiles: PlacedTile[] = [];
  for (let ty = Math.floor(originY / TILE_SIZE); ty <= Math.floor((originY + height) / TILE_SIZE); ty++) {
    if (ty < 0 || ty >= tilesPerSide) continue;
    for (let tx = Math.floor(originX / TILE_SIZE); tx <= Math.floor((originX + width) / TILE_SIZE); tx++) {
      const wrappedX = ((tx % tilesPerSide) + tilesPerSide) % tilesPerSide;
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: tileUrl(template, zoom, wrappedX, ty),
        left: Math.round(tx * TILE_SIZE - originX),
        top: Math.round(ty * TILE_SIZE - originY),
      });
    }
  }
  return tiles;
}
