// Utilidades geográficas livianas (sin dependencias).
export type LngLat = [number, number];

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distance(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const RUMBOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export const rumbo = (deg: number) => RUMBOS[Math.round(deg / 45) % 8];

export function circle(center: LngLat, radiusM: number, steps = 48): LngLat[] {
  const out: LngLat[] = [];
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos(rad(center[1])));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    out.push([center[0] + dLon * Math.cos(t), center[1] + dLat * Math.sin(t)]);
  }
  return out;
}

function inRing(p: LngLat, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(p: LngLat, rings: number[][][]): boolean {
  if (!inRing(p, rings[0])) return false;
  for (let k = 1; k < rings.length; k++) if (inRing(p, rings[k])) return false;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pointInFeature(p: LngLat, f: any): boolean {
  const g = f?.geometry;
  if (!g) return false;
  if (g.type === 'Polygon') return inPolygon(p, g.coordinates);
  if (g.type === 'MultiPolygon') return g.coordinates.some((poly: number[][][]) => inPolygon(p, poly));
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function featureAt(p: LngLat, fc: any) {
  return fc?.features?.find((f: unknown) => pointInFeature(p, f)) ?? null;
}

export const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2).replace('.', ',')} km`);
export const fmtCoord = (v: number) => v.toFixed(6).replace('.', ',');
