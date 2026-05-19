import type { PointInfo, RectInfo, TriangleInfo, CircleInfo, LineInfo, PolylineInfo, ShapeInfo } from './detail'

/** 要素类型 */
export type FeatureType = 'point' | 'rect' | 'triangle' | 'circle' | 'line' | 'polyline' | 'customShape'

/** 要素信息（判别联合类型） */
export type FeatureInfo =
  | { id: string | number; type: 'point'; wkt?: string; detail: PointInfo }
  | { id: string | number; type: 'rect'; wkt?: string; detail: RectInfo }
  | { id: string | number; type: 'triangle'; wkt?: string; detail: TriangleInfo }
  | { id: string | number; type: 'circle'; wkt?: string; detail: CircleInfo }
  | { id: string | number; type: 'line'; wkt?: string; detail: LineInfo }
  | { id: string | number; type: 'polyline'; wkt?: string; detail: PolylineInfo }
  | { id: string | number; type: 'customShape'; wkt?: string; detail: ShapeInfo }
