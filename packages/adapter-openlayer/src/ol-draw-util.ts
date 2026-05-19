import Feature from 'ol/Feature.js'
import OlMap from 'ol/Map.js'
import VectorSource from 'ol/source/Vector.js'
import VectorLayer from 'ol/layer/Vector.js'
import Point from 'ol/geom/Point.js'
import LineString from 'ol/geom/LineString.js'
import Polygon from 'ol/geom/Polygon.js'
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style.js'
import Modify from 'ol/interaction/Modify.js'
import Translate from 'ol/interaction/Translate.js'
import Collection from 'ol/Collection.js'
import type Geometry from 'ol/geom/Geometry.js'
import type { EventsKey } from 'ol/events.js'
import { unByKey } from 'ol/Observable.js'
import { DrawState } from '@loongbao-web-gis-utils/draw-utils-base-core'
import type { Coordinate, FeatureInfo, FeatureType } from '@loongbao-web-gis-utils/draw-utils-base-core'
import { IWebGisDrawBasicUtil } from '@loongbao-web-gis-utils/draw-utils-base-core'
import { generateRandomName } from './utils/name'
import {
  parseWkt,
  writeWkt,
  toOlCoord,
  toCoord,
  rectCoordsFromDiagonal,
  generateCircleCoords,
  haversineDistance,
  sphericalArea,
  extractCoords,
  computeSegmentLengths,
} from './utils/wkt'
import {
  createFeatureStyle,
  createNameStyle,
  createIconStyle,
  createAreaTextStyle,
  createLengthTextStyle as createLengthStyle,
} from './utils/style'

const SOURCE_KEY = '__draw_util_info__'
const IS_GHOST_KEY = '__is_ghost__'
const IS_MIDPOINT_KEY = '__is_midpoint__'
const DECOR_OWNER_KEY = '__decor_owner__'
const SKETCH_OWNER = '__sketch__'

type FeatureRecord = { feature: Feature; info: FeatureInfo }

const TARGET_STYLE = new Style({
  image: new CircleStyle({ radius: 6, fill: new Fill({ color: [255, 255, 255, 1] }), stroke: new Stroke({ color: [0, 153, 255, 1], width: 2 }) }),
})

const GHOST_STYLE = new Style({
  stroke: new Stroke({ color: [100, 100, 100, 0.8], width: 3, lineDash: [12, 8] }),
  fill: new Fill({ color: [100, 100, 100, 0.12] }),
})

export class OlDrawUtil extends IWebGisDrawBasicUtil {
  declare protected map: OlMap
  private vectorSource!: VectorSource
  private vectorLayer!: VectorLayer

  private state: DrawState = DrawState.IDLE
  private currentInfo: FeatureInfo | null = null
  private completionCallback: ((feature: FeatureInfo) => void) | undefined

  private features = new Map<string | number, FeatureRecord>()

  private sketch: Feature | null = null
  private stage: number = -1
  private stageCoords: Coordinate[] = []

  private editGhost: Feature | null = null
  private editMidpoints: Feature[] = []
  private interactions: (Modify | Translate)[] = []
  private editFeature: Feature | null = null
  private editChangeKey: EventsKey | null = null
  private midpointSyncFn: (() => void) | null = null
  private rectOriginalCoords: number[][] | null = null
  private isCorrectingRect = false
  private highlightedFeature: Feature | null = null
  private decorTimer: ReturnType<typeof setTimeout> | null = null

  constructor(map: OlMap, pickUpCallback: (features: FeatureInfo[]) => void) {
    super(map, pickUpCallback)
    this.vectorSource = new VectorSource()
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature, resolution) => this.styleFunction(feature as Feature, resolution),
    })
    this.map.addLayer(this.vectorLayer)
  }

  private styleFunction(feature: Feature, resolution: number): Style[] {
    if (feature.get(IS_GHOST_KEY)) {
      const geom = feature.getGeometry()
      if (geom && geom.getType() === 'Point') {
        return [new Style({
          image: new CircleStyle({ radius: 8, fill: new Fill({ color: [100, 100, 100, 0.3] }), stroke: new Stroke({ color: [100, 100, 100, 0.6], width: 2, lineDash: [6, 4] }) }),
        })]
      }
      return [GHOST_STYLE]
    }
    if (feature.get(IS_MIDPOINT_KEY)) return [TARGET_STYLE]
    const info = feature.get(SOURCE_KEY) as FeatureInfo | undefined
    if (!info) {
      const geom = feature.getGeometry()
      if (!geom) return []
      if (geom.getType() === 'Point') return [new Style({ image: new CircleStyle({ radius: 6, fill: new Fill({ color: [255, 0, 0, 0.4] }) }) })]
      return [new Style({ stroke: new Stroke({ color: [255, 0, 0, 0.6], width: 2, lineDash: [6, 4] }), fill: new Fill({ color: [255, 0, 0, 0.1] }) })]
    }
    if (info === ('__decor__' as unknown)) return []
    const styles: Style[] = []
    const isHighlight = this.highlightedFeature === feature
    styles.push(createFeatureStyle(info, isHighlight, resolution))
    styles.push(createNameStyle(info, resolution))
    styles.push(createIconStyle(info, resolution))
    return styles
  }

  // ========= 公共 API =========

  click(coord: Coordinate): void {
    if (this.state === DrawState.IDLE) { this.doHitDetection(coord); return }
    if (this.state === DrawState.CREATING) { this.handleCreatingClick(coord); return }
  }

  dblclick(coord: Coordinate): void {
    if (this.state === DrawState.IDLE) { this.doHitDetection(coord); return }
    if (this.state === DrawState.CREATING) { this.handleCreatingDblClick(coord); return }
    if (this.state === DrawState.EDITING) { this.finishEdit(); return }
  }

  move(coord: Coordinate): void {
    if (this.state === DrawState.IDLE) { this.doMoveHitDetection(coord); return }
    if (this.state === DrawState.CREATING && this.stage >= 0) { this.handleCreatingMove(coord); return }
  }

  createFeature(info: FeatureInfo, callback?: (feature: FeatureInfo) => void): boolean {
    if (this.state !== DrawState.IDLE) return false
    const detail = { ...info.detail }
    if (!detail.name) { (detail as Record<string, unknown>).name = generateRandomName() }
    const normalizedInfo = { ...info, detail } as FeatureInfo
    this.state = DrawState.CREATING
    this.currentInfo = normalizedInfo
    this.completionCallback = callback
    this.stage = -1
    this.stageCoords = []
    this.clearSketch()
    return true
  }

  updateFeature(info: FeatureInfo, callback?: (feature: FeatureInfo) => void): boolean {
    if (this.state !== DrawState.IDLE) return false
    if (!info.wkt) return false
    const record = this.features.get(info.id)
    if (!record) return false

    this.state = DrawState.EDITING
    this.currentInfo = info
    this.completionCallback = callback

    // 复制原始要素为 ghost，标记 IS_GHOST_KEY 让 styleFunction 用灰色虚线渲染
    const geom = record.feature.getGeometry()?.clone() ?? null
    if (geom) {
      this.editGhost = new Feature(geom)
      this.editGhost.set(IS_GHOST_KEY, true)
      this.vectorSource.addFeature(this.editGhost)
    }

    // 移除该要素的旧装饰，后续由 scheduleDecorRefresh 实时重建
    this.removeDecorations(String(info.id))

    this.setupEditInteractions(info, record.feature)
    return true
  }

  deleteFeature(id: string | number, callback?: (feature: FeatureInfo) => void): boolean {
    if (this.state !== DrawState.IDLE) return false
    const record = this.features.get(id)
    if (!record) return false
    this.removeDecorations(String(id))
    this.vectorSource.removeFeature(record.feature)
    this.features.delete(id)
    callback?.(record.info)
    return true
  }

  addFeature(info: FeatureInfo): boolean {
    if (!info.wkt) return false
    if (this.features.has(info.id)) return false
    const geom = parseWkt(info.wkt)
    const detail = { ...info.detail }
    if (!detail.name) { (detail as Record<string, unknown>).name = generateRandomName() }
    const feature = new Feature(geom)
    feature.set(SOURCE_KEY, { ...info, detail } as FeatureInfo)
    this.vectorSource.addFeature(feature)
    this.features.set(info.id, { feature, info: { ...info, detail } as FeatureInfo })
    this.addDecorations(info, geom, String(info.id))
    return true
  }

  modifyFeature(info: FeatureInfo): boolean {
    if (!info.wkt) return false
    const record = this.features.get(info.id)
    if (!record) return false
    // 若正在编辑该要素，先关闭编辑
    if (this.state === DrawState.EDITING && this.currentInfo?.id === info.id) {
      this.teardownEditInteractions()
      this.state = DrawState.IDLE
      this.currentInfo = null
      if (this.editGhost) { this.vectorSource.removeFeature(this.editGhost); this.editGhost = null }
    }
    // 移除旧要素和装饰
    this.removeDecorations(String(info.id))
    this.vectorSource.removeFeature(record.feature)
    // 创建新要素
    const geom = parseWkt(info.wkt)
    const newFeature = new Feature(geom)
    newFeature.set(SOURCE_KEY, { ...info } as FeatureInfo)
    this.vectorSource.addFeature(newFeature)
    this.features.set(info.id, { feature: newFeature, info: { ...info } as FeatureInfo })
    this.addDecorations(info, geom, String(info.id))
    return true
  }

  clear(callback?: (features: FeatureInfo[]) => void): boolean {
    this.clearSketch()
    this.teardownEditInteractions()
    this.state = DrawState.IDLE
    this.stage = -1
    this.stageCoords = []
    const all = Array.from(this.features.values()).map((r) => r.info)
    this.features.clear()
    this.vectorSource.clear()
    callback?.(all)
    return true
  }

  getState(): DrawState { return this.state }

  destroy(): void {
    this.teardownEditInteractions()
    this.clear()
    this.map.removeLayer(this.vectorLayer)
    this.vectorSource.dispose()
  }

  // ========= 装饰管理 =========

  private removeDecorations(ownerId?: string): void {
    const toRemove = this.vectorSource.getFeatures().filter((f) => {
      if (f.get(SOURCE_KEY) !== '__decor__') return false
      if (ownerId == null) return true
      return f.get(DECOR_OWNER_KEY) === ownerId
    })
    for (const f of toRemove) { this.vectorSource.removeFeature(f) }
  }

  private addDeco(feature: Feature, ownerId: string): void {
    feature.set(SOURCE_KEY, '__decor__')
    feature.set(DECOR_OWNER_KEY, ownerId)
    this.vectorSource.addFeature(feature)
  }

  private addDecorations(info: FeatureInfo, geom: Geometry, ownerId: string): void {
    const t = info.type
    if (t === 'rect' || t === 'triangle' || t === 'circle' || t === 'customShape') {
      try {
        const area = sphericalArea(extractCoords(geom))
        if (area > 0) {
          // 显式计算中心点放置面积标签（避免 OL getInteriorPoint 偏差）
          const coords = extractCoords(geom)
          const n = coords.length - 1  // 排除闭合顶点
          let cx = 0; let cy = 0
          for (let i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1] }
          cx /= n; cy /= n
          const f = new Feature({ geometry: new Point(toOlCoord([cx, cy])) })
          f.setStyle(createAreaTextStyle(area))
          this.addDeco(f, ownerId)
        }
      } catch { /* */ }
    }
    if (t === 'circle') {
      const polyGeom = geom as Polygon
      const outerRing = polyGeom.getCoordinates()[0]
      const n = outerRing.length - 1
      let cx = 0; let cy = 0
      for (let i = 0; i < n; i++) { cx += outerRing[i][0]; cy += outerRing[i][1] }
      cx /= n; cy /= n
      const center: [number, number] = [cx, cy]
      const radiusM = haversineDistance(toCoord(center), toCoord(outerRing[0] as unknown as number[]))
      const f = new Feature({ geometry: new Point([cx - 0.0001, cy]) })
      f.setStyle(createLengthStyle(radiusM, [cx - 0.0001, cy]))
      this.addDeco(f, ownerId)
      return
    }
    if (t !== 'point') {
      const coords = extractCoords(geom)
      const segments = computeSegmentLengths(coords)
      for (const seg of segments) {
        const f = new Feature({ geometry: new Point(toOlCoord(seg.coord)) })
        f.setStyle(createLengthStyle(seg.length, toOlCoord(seg.coord)))
        this.addDeco(f, ownerId)
      }
    }
  }

  /** 编辑中节流刷新装饰 + 中点同步（60ms）*/
  private scheduleEditUpdate(): void {
    if (this.decorTimer) return
    this.decorTimer = setTimeout(() => {
      this.decorTimer = null
      if (this.midpointSyncFn) this.midpointSyncFn()
      if (this.editFeature && this.currentInfo) {
        const ownerId = String(this.currentInfo.id)
        this.removeDecorations(ownerId)
        const geom = this.editFeature.getGeometry()
        if (geom) { this.addDecorations(this.currentInfo, geom, ownerId) }
      }
    }, 60)
  }

  /** change 事件入口：矩形立即矫正 + 节流更新 */
  private onEditFeatureChange(): void {
    if (this.currentInfo?.type === 'rect' && this.rectOriginalCoords && this.editFeature) {
      this.correctRectShape(this.editFeature)
    }
    this.scheduleEditUpdate()
  }

  /** 拖拽中立即将矩形纠正回矩形（对角线对顶点不变） */
  private correctRectShape(feature: Feature): void {
    if (this.isCorrectingRect) return
    this.isCorrectingRect = true
    try {
      const g = feature.getGeometry() as Polygon
      if (!g || !this.rectOriginalCoords || this.rectOriginalCoords.length < 5) { this.isCorrectingRect = false; return }
      const curr = g.getCoordinates()[0]
      if (curr.length < 5) { this.isCorrectingRect = false; return }
      let movedIdx = -1
      for (let i = 0; i < 4; i++) {
        if (curr[i][0] !== this.rectOriginalCoords[i][0] || curr[i][1] !== this.rectOriginalCoords[i][1]) { movedIdx = i; break }
      }
      if (movedIdx < 0) { this.isCorrectingRect = false; return }
      const fixedIdx = (movedIdx + 2) % 4
      const rect = rectCoordsFromDiagonal(
        toCoord(curr[movedIdx] as unknown as Coordinate),
        toCoord(curr[fixedIdx] as unknown as Coordinate),
      ).map(toOlCoord)
      // 更新基准坐标，避免下次与已纠正的值比较
      this.rectOriginalCoords = rect.slice()
      g.setCoordinates([rect])
      this.updateRectMidpoints(feature)
    } finally {
      this.isCorrectingRect = false
    }
  }

  // ========= 编辑交互管理 =========

  private setupEditInteractions(info: FeatureInfo, targetFeature: Feature): void {
    this.teardownEditInteractions()
    this.editFeature = targetFeature
    this.editChangeKey = targetFeature.on('change', () => this.onEditFeatureChange())
    const t = info.type
    const ownerId = String(info.id)
    if (t === 'point') {
      const translate = new Translate({ features: new Collection([targetFeature]) })
      translate.on('translating', () => this.scheduleEditUpdate())
      this.addInteraction(translate)
    } else if (t === 'line') {
      this.setupLineEdit(targetFeature)
    } else if (t === 'rect') {
      this.setupRectEdit(targetFeature)
    } else if (t === 'circle') {
      this.setupCircleEdit(targetFeature, info)
    } else if (t === 'triangle') {
      this.setupTriangleEdit(targetFeature)
    } else if (t === 'polyline' || t === 'customShape') {
      const modify = new Modify({ features: new Collection([targetFeature]), insertVertexCondition: () => true })
      this.addInteraction(modify)
    }
    // 进入编辑时立刻展示当前装饰
    const geom = targetFeature.getGeometry()
    if (geom) { this.addDecorations(info, geom, ownerId) }
  }

  private teardownEditInteractions(): void {
    for (const inter of this.interactions) { this.map.removeInteraction(inter) }
    this.interactions = []
    for (const f of this.editMidpoints) { this.vectorSource.removeFeature(f) }
    this.editMidpoints = []
    if (this.editChangeKey) { unByKey(this.editChangeKey); this.editChangeKey = null }
    this.editFeature = null
    this.midpointSyncFn = null
    this.rectOriginalCoords = null
    this.isCorrectingRect = false
    if (this.decorTimer) { clearTimeout(this.decorTimer); this.decorTimer = null }
  }

  private addInteraction(inter: Modify | Translate): void {
    this.interactions.push(inter)
    this.map.addInteraction(inter)
  }

  // ========= 各图形编辑 =========

  private setupLineEdit(feature: Feature): void {
    const modify = new Modify({ features: new Collection([feature]), insertVertexCondition: () => false })
    this.addInteraction(modify)

    const geom = feature.getGeometry() as LineString
    if (!geom) return
    const coords = geom.getCoordinates()
    if (coords.length >= 2) {
      if (coords.length > 2) geom.setCoordinates([coords[0], coords[coords.length - 1]])
      const midRef = { x: (coords[0][0] + coords[1][0]) / 2, y: (coords[0][1] + coords[1][1]) / 2 }
      const midF = new Feature(new Point([midRef.x, midRef.y]))
      midF.set(IS_MIDPOINT_KEY, true)
      this.vectorSource.addFeature(midF)
      this.editMidpoints.push(midF)

      const syncMidpoint = () => {
        const l = feature.getGeometry() as LineString
        if (!l) return
        const c = l.getCoordinates()
        if (c.length < 2) return
        const cx = (c[0][0] + c[1][0]) / 2
        const cy = (c[0][1] + c[1][1]) / 2
        ;(midF.getGeometry() as Point).setCoordinates([cx, cy])
        midRef.x = cx; midRef.y = cy
      }
      this.midpointSyncFn = syncMidpoint

      modify.on('modifyend', () => {
        const lg = feature.getGeometry() as LineString
        if (lg) {
          const coords2 = lg.getCoordinates()
          if (coords2.length > 2) lg.setCoordinates([coords2[0], coords2[coords2.length - 1]])
        }
      })

      const translate = new Translate({ features: new Collection([midF]) })
      translate.on('translating', () => {
        const nc = (midF.getGeometry() as Point).getCoordinates()
        const dx = nc[0] - midRef.x; const dy = nc[1] - midRef.y
        const lg = feature.getGeometry() as LineString
        if (lg && lg.getCoordinates().length === 2) {
          const lc = lg.getCoordinates()
          lg.setCoordinates([[lc[0][0] + dx, lc[0][1] + dy], [lc[1][0] + dx, lc[1][1] + dy]])
        }
        midRef.x = nc[0]; midRef.y = nc[1]
        this.scheduleEditUpdate()
      })
      this.addInteraction(translate)
    }
  }

  private setupRectEdit(feature: Feature): void {
    const modify = new Modify({ features: new Collection([feature]), insertVertexCondition: () => false })
    modify.on('modifystart', () => {
      const g = feature.getGeometry() as Polygon
      if (g) { this.rectOriginalCoords = g.getCoordinates()[0].slice() }
    })
    modify.on('modifyend', () => {
      const g = feature.getGeometry() as Polygon
      if (!g || !this.rectOriginalCoords || this.rectOriginalCoords.length < 5) return
      const curr = g.getCoordinates()[0]
      if (curr.length < 5) { g.setCoordinates([this.rectOriginalCoords]); this.updateRectMidpoints(feature); return }
      // 兜底确保是矩形（change 事件已实时矫正，此处是最终确保）
      let movedIdx = 0
      for (let i = 0; i < 4; i++) {
        if (curr[i][0] !== this.rectOriginalCoords[i][0] || curr[i][1] !== this.rectOriginalCoords[i][1]) { movedIdx = i; break }
      }
      const fixedIdx = (movedIdx + 2) % 4
      g.setCoordinates([rectCoordsFromDiagonal(
        toCoord(curr[movedIdx] as unknown as Coordinate),
        toCoord(curr[fixedIdx] as unknown as Coordinate),
      ).map(toOlCoord)])
      this.rectOriginalCoords = null
      this.updateRectMidpoints(feature)
    })
    this.addInteraction(modify)
    this.createRectMidpoints(feature)
  }

  private createRectMidpoints(feature: Feature): void {
    const geom = feature.getGeometry() as Polygon
    if (!geom) return
    const ring = geom.getCoordinates()[0]
    const edges = [
      { idx: 0, name: 'bottom' }, { idx: 1, name: 'right' }, { idx: 2, name: 'top' }, { idx: 3, name: 'left' },
    ]
    for (const e of edges) {
      const p1 = ring[e.idx]; const p2 = ring[(e.idx + 1) % 4]
      const midCoord: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
      const midF = new Feature(new Point(midCoord))
      midF.set(IS_MIDPOINT_KEY, true)
      midF.set('edge_name', e.name)
      this.vectorSource.addFeature(midF)
      this.editMidpoints.push(midF)

      const translate = new Translate({ features: new Collection([midF]) })
      translate.on('translating', () => {
        const nc = (midF.getGeometry() as Point).getCoordinates()
        const r = (feature.getGeometry() as Polygon).getCoordinates()[0]
        if (e.name === 'top') { r[2][1] = nc[1]; r[3][1] = nc[1] }
        else if (e.name === 'bottom') { r[0][1] = nc[1]; r[1][1] = nc[1]; r[4][1] = nc[1] }
        else if (e.name === 'right') { r[1][0] = nc[0]; r[2][0] = nc[0] }
        else if (e.name === 'left') { r[0][0] = nc[0]; r[3][0] = nc[0]; r[4][0] = nc[0] }
        ;(feature.getGeometry() as Polygon).setCoordinates([r])
        // 同步基准：避免 correctRectShape 把边平移误判为顶点拖拽
        if (this.rectOriginalCoords) {
          this.rectOriginalCoords = r.slice()
        }
        this.scheduleEditUpdate()
      })
      this.addInteraction(translate)
    }
  }

  /** 仅更新已有的边中点位置（不重建交互） */
  private updateRectMidpoints(feature: Feature): void {
    const geom = feature.getGeometry() as Polygon
    if (!geom) return
    const ring = geom.getCoordinates()[0]
    const edges = [
      { idx: 0, name: 'bottom' }, { idx: 1, name: 'right' }, { idx: 2, name: 'top' }, { idx: 3, name: 'left' },
    ]
    for (const f of this.editMidpoints) {
      const en = f.get('edge_name') as string
      const e = edges.find(x => x.name === en)
      if (e) {
        const p1 = ring[e.idx]; const p2 = ring[(e.idx + 1) % 4]
        ;(f.getGeometry() as Point).setCoordinates([(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2])
      }
    }
  }

  private setupTriangleEdit(feature: Feature): void {
    const modify = new Modify({ features: new Collection([feature]), insertVertexCondition: () => false })
    modify.on('modifyend', () => {
      const g = feature.getGeometry() as Polygon
      if (g && g.getCoordinates()[0].length !== 4) {
        const pts = extractCoords(g)
        if (pts.length >= 3) g.setCoordinates([[...pts.slice(0, 3).map(toOlCoord), toOlCoord(pts[0])]])
      }
      this.updateTriangleMidpoints(feature)
    })
    this.addInteraction(modify)
    this.createTriangleMidpoints(feature)
  }

  private createTriangleMidpoints(feature: Feature): void {
    const geom = feature.getGeometry() as Polygon
    if (!geom) return
    const ring = geom.getCoordinates()[0]
    for (let i = 0; i < 3; i++) {
      const p1 = ring[i]; const p2 = ring[i + 1]
      const midCoord: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
      const edgeIdx = i
      const midF = new Feature(new Point(midCoord))
      midF.set(IS_MIDPOINT_KEY, true)
      midF.set('tri_edge', edgeIdx)
      this.vectorSource.addFeature(midF)
      this.editMidpoints.push(midF)

      const translate = new Translate({ features: new Collection([midF]) })
      translate.on('translating', () => {
        const nc = (midF.getGeometry() as Point).getCoordinates()
        const r = (feature.getGeometry() as Polygon).getCoordinates()[0]
        // 每帧从当前几何中点计算全量 delta
        const curMidX = (r[edgeIdx][0] + r[edgeIdx + 1][0]) / 2
        const curMidY = (r[edgeIdx][1] + r[edgeIdx + 1][1]) / 2
        const dx = nc[0] - curMidX
        const dy = nc[1] - curMidY
        if (dx === 0 && dy === 0) return
        // 边平移: 两个端点同步移动
        r[edgeIdx][0] += dx; r[edgeIdx][1] += dy
        r[edgeIdx + 1][0] += dx; r[edgeIdx + 1][1] += dy
        // 闭环顶点同步 (r[0] 与 r[3] 是同一顶点)
        if (edgeIdx === 0) { r[3][0] += dx; r[3][1] += dy }
        else if (edgeIdx === 2) { r[0][0] += dx; r[0][1] += dy }
        // 最终确保首尾闭合
        r[3][0] = r[0][0]; r[3][1] = r[0][1]
        ;(feature.getGeometry() as Polygon).setCoordinates([r.slice()])
        this.scheduleEditUpdate()
      })
      translate.on('translateend', () => {
        // 拖拽结束后同步中点位置，清除 Modify 可能造成的多余顶点
        const g = feature.getGeometry() as Polygon
        if (g && g.getCoordinates()[0].length !== 4) {
          const pts = extractCoords(g)
          if (pts.length >= 3) g.setCoordinates([[...pts.slice(0, 3).map(toOlCoord), toOlCoord(pts[0])]])
        }
        this.updateTriangleMidpoints(feature)
      })
      this.addInteraction(translate)
    }
    // 顶点拖拽时实时更新中点
    this.midpointSyncFn = () => this.updateTriangleMidpoints(feature)
  }

  /** 顶点拖拽后更新边中点位置 */
  private updateTriangleMidpoints(feature: Feature): void {
    const geom = feature.getGeometry() as Polygon
    if (!geom) return
    const ring = geom.getCoordinates()[0]
    for (const f of this.editMidpoints) {
      const ei = f.get('tri_edge') as number | undefined
      if (ei != null && ring[ei] && ring[ei + 1]) {
        const p1 = ring[ei]; const p2 = ring[ei + 1]
        ;(f.getGeometry() as Point).setCoordinates([(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2])
      }
    }
  }

  private setupCircleEdit(feature: Feature, info: FeatureInfo): void {
    const wkt = info.wkt
    if (!wkt) return
    const centerPoint = parseWkt(wkt) as Point
    const center = centerPoint.getCoordinates() as [number, number]
    const radiusMeters = (info.detail as { radius: number }).radius
    const metersPerDegLat = 111320
    const radiusLng = radiusMeters / (metersPerDegLat * Math.cos((center[1] * Math.PI) / 180))
    const targetCoord: [number, number] = [center[0] + radiusLng, center[1]]

    const midF = new Feature(new Point(targetCoord))
    midF.set(IS_MIDPOINT_KEY, true)
    this.vectorSource.addFeature(midF)
    this.editMidpoints.push(midF)

    const updateCircle = (newRadiusMeters: number) => {
      const circleCoords = generateCircleCoords(toCoord(center), newRadiusMeters).map(toOlCoord)
      const polyGeom = feature.getGeometry() as Polygon
      if (polyGeom) { polyGeom.setCoordinates([circleCoords]) }
      const detail = info.detail as { radius: number }; detail.radius = Math.round(newRadiusMeters)
    }

    const translate = new Translate({ features: new Collection([midF]) })
    translate.on('translating', () => {
      const newCoord = (midF.getGeometry() as Point).getCoordinates()
      const r = haversineDistance(toCoord(center), toCoord(newCoord as number[]))
      updateCircle(r)
      this.scheduleEditUpdate()
    })
    this.addInteraction(translate)
  }

  // ========= 命中检测 =========

  private doHitDetection(coord: Coordinate): void {
    const pixel = this.map.getPixelFromCoordinate(toOlCoord(coord))
    const found = this.map.getFeaturesAtPixel(pixel, { hitTolerance: 5, layerFilter: (l) => l === this.vectorLayer })
    if (found && found.length > 0) {
      const infos: FeatureInfo[] = []
      for (const f of found) { if (f instanceof Feature) { const i = f.get(SOURCE_KEY) as FeatureInfo | undefined; if (i && i !== ('__decor__' as unknown)) infos.push(i) } }
      if (infos.length > 0) this.pickUpCallback(infos)
    }
  }

  private doMoveHitDetection(coord: Coordinate): void {
    const pixel = this.map.getPixelFromCoordinate(toOlCoord(coord))
    const found = this.map.getFeaturesAtPixel(pixel, { hitTolerance: 5, layerFilter: (l) => l === this.vectorLayer })
    if (this.highlightedFeature) { this.highlightedFeature.changed(); this.highlightedFeature = null }
    if (found && found.length > 0) {
      for (const f of found) { if (f instanceof Feature) { const info = f.get(SOURCE_KEY); if (info && info !== ('__decor__' as unknown)) { this.highlightedFeature = f; f.changed(); break } } }
    }
  }

  // ========= 新建绘制 =========

  private type(): FeatureType { return this.currentInfo!.type }

  private handleCreatingClick(coord: Coordinate): void {
    const t = this.type()
    if (t === 'triangle' && this.stage === 0) { this.stageCoords.push([...coord]); this.stage = 1; this.updateSketch(coord); return }
    if (t === 'polyline' && this.stage >= 0) { this.stageCoords.push([...coord]); this.updateSketch(coord); return }
    if (t === 'customShape' && this.stage >= 0) { this.stageCoords.push([...coord]); this.updateSketch(coord); return }
  }

  private handleCreatingDblClick(coord: Coordinate): void {
    const t = this.type(); const lng = coord[0]; const lat = coord[1]
    if (t === 'point') { this.finishCreate([lng, lat]); return }
    if (this.stage === -1) { this.stageCoords.push([lng, lat]); this.stage = 0; this.updateSketch(coord); return }
    if (t === 'line' && this.stageCoords.length === 1) { this.stageCoords.push([lng, lat]); this.finishCreate([lng, lat]); return }
    if (t === 'rect' && this.stageCoords.length === 1) { this.stageCoords.push([lng, lat]); this.finishCreate([lng, lat]); return }
    if (t === 'triangle' && this.stageCoords.length >= 2) { this.stageCoords.push([lng, lat]); this.finishCreate([lng, lat]); return }
    if (t === 'circle' && this.stageCoords.length === 1) { this.stageCoords.push([lng, lat]); this.finishCreate([lng, lat]); return }
    if (t === 'polyline' && this.stageCoords.length >= 2) { this.stageCoords.push([lng, lat]); this.finishCreate([lng, lat]); return }
    if (t === 'customShape' && this.stageCoords.length >= 2) { this.stageCoords.push([lng, lat]); this.finishCreate([lng, lat]); return }
  }

  private handleCreatingMove(coord: Coordinate): void {
    if (this.stage === -1) return
    this.updateSketch(coord)
  }

  private updateSketch(coord: Coordinate): void {
    const t = this.type(); let geom: Geometry | null = null
    try {
      if (t === 'point') { geom = new Point(toOlCoord(coord)) }
      else if (t === 'line') { if (this.stageCoords.length >= 1) geom = new LineString([...this.stageCoords.map(toOlCoord), toOlCoord(coord)]) }
      else if (t === 'rect') { if (this.stageCoords.length >= 1) geom = new Polygon([rectCoordsFromDiagonal(this.stageCoords[0], coord).map(toOlCoord)]) }
      else if (t === 'triangle') {
        if (this.stageCoords.length === 1) geom = new LineString([toOlCoord(this.stageCoords[0]), toOlCoord(coord)])
        else if (this.stageCoords.length >= 2) geom = new Polygon([[...this.stageCoords.map(toOlCoord), toOlCoord(coord), toOlCoord(this.stageCoords[0])]])
      }
      else if (t === 'circle') { if (this.stageCoords.length >= 1) { const r = haversineDistance(this.stageCoords[0], coord); geom = new Polygon([generateCircleCoords(this.stageCoords[0], r).map(toOlCoord)]) } }
      else if (t === 'polyline') { if (this.stageCoords.length >= 1) geom = new LineString([...this.stageCoords.map(toOlCoord), toOlCoord(coord)]) }
      else if (t === 'customShape') { if (this.stageCoords.length >= 1) geom = new Polygon([[...this.stageCoords.map(toOlCoord), toOlCoord(coord), toOlCoord(this.stageCoords[0])]]) }
    } catch { return }
    if (geom) {
      if (!this.sketch) { this.sketch = new Feature(geom); this.vectorSource.addFeature(this.sketch) }
      else { this.sketch.setGeometry(geom) }
      // 新建过程实时渲染装饰
      if (geom.getType() !== 'Point' || this.stageCoords.length > 0) {
        this.removeDecorations(SKETCH_OWNER)
        if (this.currentInfo) { this.addDecorations(this.currentInfo, geom, SKETCH_OWNER) }
      }
    }
  }

  private clearSketch(): void {
    this.removeDecorations(SKETCH_OWNER)
    if (this.sketch) { this.vectorSource.removeFeature(this.sketch); this.sketch = null }
  }

  private finishCreate(finalCoord: Coordinate): void {
    const t = this.type(); let olGeom: Geometry | null = null
    try {
      if (t === 'point') { olGeom = new Point(toOlCoord(finalCoord)) }
      else if (t === 'line') { const [p1, p2] = this.stageCoords; olGeom = new LineString([toOlCoord(p1), toOlCoord(p2)]) }
      else if (t === 'rect') { olGeom = new Polygon([rectCoordsFromDiagonal(this.stageCoords[0], this.stageCoords[1]).map(toOlCoord)]) }
      else if (t === 'triangle') { const pts = this.stageCoords; olGeom = new Polygon([[...pts.map(toOlCoord), toOlCoord(pts[0])]]) }
      else if (t === 'circle') {
        const center = this.stageCoords[0]; const r = haversineDistance(center, this.stageCoords[1])
        olGeom = new Polygon([generateCircleCoords(center, r).map(toOlCoord)])
        const centerPoint = new Point(toOlCoord(center))
        const wkt = writeWkt(centerPoint)
        const info = { ...this.currentInfo!, wkt, detail: { ...this.currentInfo!.detail, radius: Math.round(r) } } as FeatureInfo
        this.persistFeature(olGeom, info); return
      }
      else if (t === 'polyline') { olGeom = new LineString(this.stageCoords.map(toOlCoord)) }
      else if (t === 'customShape') { const pts = this.stageCoords; olGeom = new Polygon([[...pts.map(toOlCoord), toOlCoord(pts[0])]]) }
    } catch { this.resetToIdle(); return }
    if (!olGeom) { this.resetToIdle(); return }
    const wkt = writeWkt(olGeom); const info = { ...this.currentInfo!, wkt } as FeatureInfo
    this.persistFeature(olGeom, info)
  }

  private persistFeature(olGeom: Geometry, info: FeatureInfo): void {
    this.clearSketch()
    const ownerId = String(info.id)
    const feature = new Feature(olGeom); feature.set(SOURCE_KEY, info)
    this.vectorSource.addFeature(feature); this.features.set(info.id, { feature, info })
    this.addDecorations(info, olGeom, ownerId)
    this.completionCallback?.(info); this.resetToIdle()
  }

  private finishEdit(): void {
    this.teardownEditInteractions()
    const record = this.features.get(this.currentInfo!.id)
    if (!record) { this.resetToIdle(); return }
    const feature = record.feature; const geom = feature.getGeometry()
    if (!geom) { this.resetToIdle(); return }

    const t = this.currentInfo!.type
    let wkt: string
    const detail = { ...this.currentInfo!.detail }

    if (t === 'circle') {
      const polyGeom = geom as Polygon
      const outerRing = polyGeom.getCoordinates()[0]
      let cx = 0; let cy = 0; const n = outerRing.length - 1
      for (let i = 0; i < n; i++) { cx += outerRing[i][0]; cy += outerRing[i][1] }
      const center = new Point([cx / n, cy / n])
      wkt = writeWkt(center)
      const centerCoord = toCoord([cx / n, cy / n])
      const edge = toCoord(outerRing[0] as unknown as number[])
      ;(detail as Record<string, unknown>).radius = Math.round(haversineDistance(centerCoord, edge))
    } else {
      wkt = writeWkt(geom)
    }

    const ownerId = String(this.currentInfo!.id)
    const info = { ...this.currentInfo!, wkt, detail } as FeatureInfo
    feature.set(SOURCE_KEY, info); record.info = info

    // 移除编辑态装饰和 ghost
    this.removeDecorations(ownerId)
    if (this.editGhost) { this.vectorSource.removeFeature(this.editGhost); this.editGhost = null }

    // 添加最终装饰
    this.addDecorations(info, geom, ownerId)
    this.completionCallback?.(info); this.resetToIdle()
  }

  private resetToIdle(): void {
    this.state = DrawState.IDLE; this.currentInfo = null; this.completionCallback = undefined
    this.stage = -1; this.stageCoords = []; this.clearSketch()
    this.teardownEditInteractions()
    if (this.editGhost) { this.vectorSource.removeFeature(this.editGhost); this.editGhost = null }
  }
}
