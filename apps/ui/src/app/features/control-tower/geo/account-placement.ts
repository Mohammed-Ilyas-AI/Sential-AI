import { isLand, type GeoPoint } from './land-mask';

const RADIANS = Math.PI / 180;
const MIN_SPREAD_DEGREES = 4;
const MAX_SPREAD_DEGREES = 24;
const ATTEMPTS = 16;

/** FNV-1a over the id, so an account lands on the same spot on every screen and every run. */
function hash(text: string, salt: number): number {
  let value = 2166136261 ^ salt;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967295;
}

function offset(origin: GeoPoint, bearingDegrees: number, distanceDegrees: number): GeoPoint {
  const lat1 = origin.latitude * RADIANS;
  const lon1 = origin.longitude * RADIANS;
  const bearing = bearingDegrees * RADIANS;
  const distance = distanceDegrees * RADIANS;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1), Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: lat2 / RADIANS, longitude: ((((lon2 / RADIANS) + 540) % 360) - 180) };
}

/**
 * Where a synthetic account is drawn: on land, a short, stable distance from its bank's anchor. Illustrative
 * only; accounts carry no geography and nothing in the control path reads this.
 */
export function accountNodeFor(accountId: string, bankAnchor: GeoPoint): GeoPoint {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const bearing = hash(accountId, attempt) * 360;
    const distance = MIN_SPREAD_DEGREES + hash(accountId, attempt + 101) * (MAX_SPREAD_DEGREES - MIN_SPREAD_DEGREES);
    const candidate = offset(bankAnchor, bearing, distance);
    if (isLand(candidate.latitude, candidate.longitude)) return candidate;
  }
  return bankAnchor;
}
