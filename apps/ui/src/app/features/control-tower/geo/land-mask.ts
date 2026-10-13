import { LAND_MASK_BASE64 } from './land-mask.data';

const COLUMNS = 360;
const ROWS = 180;

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

let mask: Uint8Array | null = null;

/** True when the 1° cell containing this point is land. */
export function isLand(latitude: number, longitude: number): boolean {
  mask ??= decode(LAND_MASK_BASE64);
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor(90 - latitude)));
  const column = (((Math.floor(longitude + 180) % COLUMNS) + COLUMNS) % COLUMNS);
  const cell = row * COLUMNS + column;
  return ((mask[cell >> 3] ?? 0) >> (7 - (cell & 7))) & 1 ? true : false;
}

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/** Evenly spread points on the sphere (Fibonacci lattice), keeping only land: the dotted continents. */
export function landDots(count: number): readonly GeoPoint[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const dots: GeoPoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / (count - 1)) * 2;
    const latitude = (Math.asin(y) * 180) / Math.PI;
    const longitude = ((((index * golden * 180) / Math.PI) % 360) + 540) % 360 - 180;
    if (isLand(latitude, longitude)) dots.push({ latitude, longitude });
  }
  return dots;
}
