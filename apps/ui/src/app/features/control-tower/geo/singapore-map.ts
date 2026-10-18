import type { GeoPoint } from './land-mask';

/**
 * The Live Singapore Network artwork (`public/dashboard/singapore-network-map.webp`) and the positions the live
 * overlay uses on it, in the artwork's own pixels. The artwork is an illustration, not a survey: these points were
 * traced from it so markers sit on its land, and they carry no geographic data.
 */
export const MAP_ART = { src: '/dashboard/singapore-network-map.webp', width: 2000, height: 1116 } as const;

/** An artwork pixel position. */
export type ArtPoint = readonly [number, number];

/** The part of the artwork the card frames: the main island and its near islands. */
export const ISLAND_FRAME = { left: 330, top: 170, right: 1940, bottom: 960 } as const;

/** Coarse outline of the main island on the artwork, used to keep account markers on land. */
export const ISLAND_OUTLINE: readonly ArtPoint[] = [
  [345, 560], [385, 470], [430, 430], [475, 335], [560, 272], [640, 245], [720, 252], [800, 218], [880, 188],
  [1000, 172], [1100, 182], [1190, 205], [1225, 270], [1200, 318], [1262, 300], [1340, 292], [1420, 322],
  [1500, 352], [1560, 400], [1650, 420], [1760, 404], [1820, 432], [1840, 482], [1925, 502], [1925, 560],
  [1878, 618], [1700, 640], [1500, 660], [1300, 700], [1200, 760], [1080, 790], [980, 760], [860, 720],
  [700, 660], [600, 642], [480, 640], [382, 620],
];

export interface DistrictLabel {
  readonly label: string;
  readonly at: ArtPoint;
}

/** Place names on the artwork. Geography only: no figure on the dashboard depends on them. */
export const DISTRICT_LABELS: readonly DistrictLabel[] = [
  { label: 'Woodlands', at: [930, 236] },
  { label: 'Yishun', at: [1205, 318] },
  { label: 'Jurong', at: [560, 520] },
  { label: 'Tuas', at: [400, 598] },
  { label: 'Marina Bay', at: [1180, 690] },
  { label: 'Changi', at: [1830, 470] },
  { label: 'Sentosa', at: [1050, 850] },
];

/**
 * Where each synthetic institution is drawn. The banks are fictional and carry no address; banks beyond the first
 * three take the spare sites in order.
 */
const INSTITUTION_SITES: Readonly<Record<string, ArtPoint>> = {
  BANK_A: [1035, 600],
  BANK_B: [640, 455],
  BANK_C: [1540, 470],
};
const SPARE_SITES: readonly ArtPoint[] = [[1000, 262], [1150, 345], [880, 390], [760, 560], [1700, 560], [1330, 400]];

export function institutionSite(id: string, index: number): ArtPoint {
  return INSTITUTION_SITES[id] ?? SPARE_SITES[index % SPARE_SITES.length] ?? [1100, 480];
}

export function insideOutline([x, y]: ArtPoint, outline: readonly ArtPoint[] = ISLAND_OUTLINE): boolean {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index, index += 1) {
    const [xi, yi] = outline[index] ?? [0, 0];
    const [xj, yj] = outline[previous] ?? [0, 0];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Artwork pixels per degree of the world layout: a 24° spread becomes about 130 px around the bank. */
const SPREAD_PX_PER_DEGREE = 5.5;

/**
 * Re-places a point of the network's world layout onto the artwork: it keeps its bearing and relative distance
 * from the nearest bank, around that bank's site, pulled in until it is on the island. Deterministic.
 */
export function onMap(point: GeoPoint, banks: readonly { readonly point: GeoPoint; readonly site: ArtPoint }[]): ArtPoint {
  let nearest = banks[0];
  let best = Number.POSITIVE_INFINITY;
  for (const bank of banks) {
    const distance = Math.hypot(bank.point.latitude - point.latitude, bank.point.longitude - point.longitude);
    if (distance < best) {
      best = distance;
      nearest = bank;
    }
  }
  if (!nearest) return [1100, 480];
  const [siteX, siteY] = nearest.site;
  let dx = (point.longitude - nearest.point.longitude) * SPREAD_PX_PER_DEGREE;
  // The artwork is viewed obliquely: north-south distances are foreshortened.
  let dy = -(point.latitude - nearest.point.latitude) * SPREAD_PX_PER_DEGREE * 0.6;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate: ArtPoint = [siteX + dx, siteY + dy];
    if (insideOutline(candidate)) return candidate;
    dx /= 2;
    dy /= 2;
  }
  return nearest.site;
}
