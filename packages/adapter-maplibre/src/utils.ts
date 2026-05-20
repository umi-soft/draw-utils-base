import type { Coordinate } from '@loongbao-web-gis-utils/draw-utils-base-core'

const R = 6371008.8 // WGS84 mean radius
const toRad = (d: number) => d * Math.PI / 180

export function haversineDistance(c1: Coordinate, c2: Coordinate): number {
  const dLat = toRad(c2[1] - c1[1])
  const dLng = toRad(c2[0] - c1[0])
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(c1[1])) * Math.cos(toRad(c2[1])) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function sphericalArea(coords: Coordinate[]): number {
  const n = coords.length - 1
  let sum = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    sum += (toRad(coords[j][0]) - toRad(coords[i][0])) * (2 + Math.sin(toRad(coords[i][1])) + Math.sin(toRad(coords[j][1])))
  }
  return Math.abs(sum * R * R / 2)
}

export function rectCoordsFromDiagonal(p1: Coordinate, p2: Coordinate): Coordinate[] {
  const minLng = Math.min(p1[0], p2[0]); const maxLng = Math.max(p1[0], p2[0])
  const minLat = Math.min(p1[1], p2[1]); const maxLat = Math.max(p1[1], p2[1])
  return [[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]
}

export function generateCircleCoords(center: Coordinate, radiusMeters: number): Coordinate[] {
  const SIDES = 32; const coords: Coordinate[] = []
  const metersPerDegLat = 111320
  for (let i = 0; i < SIDES; i++) {
    const angle = (2 * Math.PI * i) / SIDES
    coords.push([
      center[0] + (radiusMeters * Math.sin(angle)) / (metersPerDegLat * Math.cos(toRad(center[1]))),
      center[1] + (radiusMeters * Math.cos(angle)) / metersPerDegLat,
    ])
  }
  coords.push(coords[0])
  return coords
}

export function buildWkt(geoType: string, coords: Coordinate[]): string {
  const fmt = (c: Coordinate) => `${c[0]} ${c[1]}`
  if (geoType === 'Point') return `POINT(${fmt(coords[0])})`
  if (geoType === 'LineString') return `LINESTRING(${coords.map(fmt).join(',')})`
  return `POLYGON((${coords.map(fmt).join(',')}))`
}
