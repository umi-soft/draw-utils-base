import { Style, Stroke, Fill, Text, Circle as CircleStyle, Icon } from 'ol/style.js'
import Point from 'ol/geom/Point.js'
import type { FeatureInfo, PointInfo, RectInfo, LineInfo } from '@loongbao-web-gis-utils/draw-utils-base-core'

type DetailInfo = PointInfo | RectInfo | LineInfo

const HIGHLIGHT_SCALE = 1.5
const ZOOM_REF_RES = 150

function parseRgba(rgba: string): number[] {
  const m = rgba.match(/[\d.]+/g)!
  return [Number(m[0]), Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 1]
}

function hasArea(type: string): boolean {
  return type === 'rect' || type === 'triangle' || type === 'circle' || type === 'customShape'
}

function zoomFactor(resolution: number): number {
  return Math.min(3, Math.max(0.5, ZOOM_REF_RES / resolution))
}

export function createFeatureStyle(featureInfo: FeatureInfo, highlight = false, resolution = ZOOM_REF_RES): Style {
  const { type, detail } = featureInfo
  const d = detail as DetailInfo

  if (type === 'point') {
    return createPointStyle(d as PointInfo, highlight, resolution)
  }
  if (hasArea(type)) {
    return createAreaStyle(d, highlight)
  }
  return createLineStyle(d, highlight)
}

function createPointStyle(info: PointInfo, highlight: boolean, resolution: number): Style {
  const [r, g, b, a] = parseRgba(info.fillRgba)
  const z = zoomFactor(resolution)

  if (info.iconSrc) {
    const scale = highlight ? HIGHLIGHT_SCALE * z : z
    return new Style({
      image: new Icon({ src: info.iconSrc, scale, anchor: [0.5, 1] }),
    })
  }

  const radius = highlight ? 8 * HIGHLIGHT_SCALE * z : 8 * z
  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: [r, g, b, a] }),
      stroke: new Stroke({ color: [r, g, b, 1], width: 2 }),
    }),
  })
}

function createAreaStyle(d: DetailInfo, highlight: boolean): Style {
  const fillRgba = (d as RectInfo).fillRgba
  const lineRgba = (d as RectInfo).lineRgba
  const lineWidth = (d as RectInfo).lineWidth
  const lineType = (d as RectInfo).lineType

  const [fr, fg, fb, fa] = parseRgba(fillRgba)
  const [lr, lg, lb, la] = parseRgba(lineRgba)
  const width = highlight ? lineWidth * HIGHLIGHT_SCALE : lineWidth
  const lineDash = lineType === 'dashed' ? [8, 6] : undefined

  return new Style({
    fill: new Fill({ color: [fr, fg, fb, fa] }),
    stroke: new Stroke({ color: [lr, lg, lb, la], width, lineDash }),
  })
}

function createLineStyle(d: DetailInfo, highlight: boolean): Style {
  const lineRgba = (d as LineInfo).lineRgba
  const lineWidth = (d as LineInfo).lineWidth
  const lineType = (d as LineInfo).lineType

  const [lr, lg, lb, la] = parseRgba(lineRgba)
  const width = highlight ? lineWidth * HIGHLIGHT_SCALE : lineWidth
  const lineDash = lineType === 'dashed' ? [8, 6] : undefined

  return new Style({
    stroke: new Stroke({ color: [lr, lg, lb, la], width, lineDash }),
  })
}

export function createNameStyle(featureInfo: FeatureInfo, resolution = ZOOM_REF_RES): Style {
  const d = featureInfo.detail as DetailInfo
  if (!d.name) return new Style({})

  const textRgba = (d as unknown as Record<string, string>).textRgba || 'rgba(0,0,0,1)'
  const [r, g, b] = parseRgba(textRgba)
  const z = zoomFactor(resolution)
  const fontSize = Math.round(12 * z)

  return new Style({
    text: new Text({
      text: d.name,
      font: `${fontSize}px sans-serif`,
      fill: new Fill({ color: [r, g, b, 1] }),
      offsetY: 18 * z,
      textAlign: 'center',
    }),
  })
}

export function createIconStyle(featureInfo: FeatureInfo, resolution = ZOOM_REF_RES): Style {
  const d = featureInfo.detail as DetailInfo
  if (!('iconSrc' in d) || !d.iconSrc) return new Style({})

  const z = zoomFactor(resolution)
  return new Style({
    image: new Icon({ src: d.iconSrc as string, scale: z, anchor: [0.5, 1] }),
  })
}

export function createAreaTextStyle(areaMeters: number, _resolution = ZOOM_REF_RES): Style {
  const text = areaMeters >= 1_000_000
    ? `${(areaMeters / 1_000_000).toFixed(2)} km²`
    : `${areaMeters.toFixed(2)} m²`

  return new Style({
    text: new Text({
      text,
      font: '11px sans-serif',
      fill: new Fill({ color: [0, 0, 0, 1] }),
      offsetX: 20,
      textAlign: 'left',
      placement: 'point',
      stroke: new Stroke({ color: [255, 255, 255, 0.8], width: 2 }),
    }),
  })
}

export function createLengthTextStyle(meters: number, coord: [number, number], _resolution = ZOOM_REF_RES): Style {
  const text = meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(2)} m`

  return new Style({
    geometry: new Point(coord),
    text: new Text({
      text,
      font: '11px sans-serif',
      fill: new Fill({ color: [0, 0, 0, 1] }),
      offsetY: -10,
      textAlign: 'center',
      placement: 'point',
      stroke: new Stroke({ color: [255, 255, 255, 0.8], width: 2 }),
    }),
  })
}
