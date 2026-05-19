import WKT from 'ol/format/WKT.js'
import type Geometry from 'ol/geom/Geometry.js'
import Point from 'ol/geom/Point.js'
import LineString from 'ol/geom/LineString.js'
import Polygon from 'ol/geom/Polygon.js'
import { getDistance } from 'ol/sphere.js'
import type { Coordinate } from '@loongbao-web-gis-utils/draw-utils-base-core'

const wktFormat = new WKT()

export function parseWkt(wkt: string): Geometry {
  return wktFormat.readGeometry(wkt)
}

export function writeWkt(geometry: Geometry): string {
  return wktFormat.writeGeometry(geometry)
}

export function haversineDistance(c1: Coordinate, c2: Coordinate): number {
  return getDistance(toOlCoord(c1), toOlCoord(c2))
}

/** 球面多边形面积（平方米），WGS84 球体半径 */
export function sphericalArea(coords: Coordinate[]): number {
  const R = 6371008.8
  const toRad = (d: number) => d * Math.PI / 180
  const n = coords.length - 1 // 排除闭合顶点
  let sum = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const lng1 = toRad(coords[i][0]); const lat1 = toRad(coords[i][1])
    const lng2 = toRad(coords[j][0]); const lat2 = toRad(coords[j][1])
    sum += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs(sum * R * R / 2)
}

export function toOlCoord(coord: Coordinate): [number, number] {
  return [coord[0], coord[1]]
}

export function toCoord(olCoord: number[]): Coordinate {
  return [olCoord[0], olCoord[1]]
}

export function generateCircleCoords(center: Coordinate, radiusMeters: number): Coordinate[] {
  const SIDES = 32
  const coords: Coordinate[] = []
  const metersPerDegLat = 111320

  for (let i = 0; i < SIDES; i++) {
    const angle = (2 * Math.PI * i) / SIDES
    const dLat = (radiusMeters * Math.cos(angle)) / metersPerDegLat
    const dLng =
      (radiusMeters * Math.sin(angle)) / (metersPerDegLat * Math.cos((center[1] * Math.PI) / 180))
    coords.push([center[0] + dLng, center[1] + dLat])
  }
  coords.push(coords[0])
  return coords
}

export function rectCoordsFromDiagonal(p1: Coordinate, p2: Coordinate): Coordinate[] {
  const minLng = Math.min(p1[0], p2[0])
  const maxLng = Math.max(p1[0], p2[0])
  const minLat = Math.min(p1[1], p2[1])
  const maxLat = Math.max(p1[1], p2[1])
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ]
}

export function extractCoords(geometry: Geometry): Coordinate[] {
  const type = geometry.getType()
  if (type === 'Point') {
    return [toCoord((geometry as Point).getCoordinates())]
  }
  if (type === 'LineString') {
    return (geometry as LineString).getCoordinates().map((c) => toCoord(c))
  }
  if (type === 'Polygon') {
    return (geometry as Polygon).getCoordinates()[0].map((c) => toCoord(c))
  }
  return []
}

export function computeSegmentLengths(
  coords: Coordinate[],
): Array<{ coord: Coordinate; length: number }> {
  const segments: Array<{ coord: Coordinate; length: number }> = []
  for (let i = 0; i < coords.length - 1; i++) {
    const d = haversineDistance(coords[i], coords[i + 1])
    const mid: Coordinate = [
      (coords[i][0] + coords[i + 1][0]) / 2,
      (coords[i][1] + coords[i + 1][1]) / 2,
    ]
    segments.push({ coord: mid, length: d })
  }
  return segments
}
