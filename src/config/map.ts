/**
 * Raster tile source for the order-screen map, as an `{z}/{x}/{y}` URL template.
 * The default is OpenStreetMap's public tiles, which are for light use only: set
 * EXPO_PUBLIC_MAP_TILE_URL to a proper tile provider before production traffic.
 */
export const MAP_TILE_URL =
  process.env.EXPO_PUBLIC_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Shown on the map; required by the OpenStreetMap tile usage policy. */
export const MAP_ATTRIBUTION = process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors';
