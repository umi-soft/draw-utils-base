import type { Coordinate } from '@loongbao-web-gis-utils/draw-utils-base-core'
import { DrawState, IWebGisDrawBasicUtil } from '@loongbao-web-gis-utils/draw-utils-base-core'
import type { FeatureInfo, FeatureType } from '@loongbao-web-gis-utils/draw-utils-base-core'
import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl'
import { generateRandomName } from './utils-name'
import { haversineDistance, sphericalArea, rectCoordsFromDiagonal, generateCircleCoords, buildWkt } from './utils'
import { getBuiltinIcon } from './utils/icon'

export { DrawState }
export type { Coordinate, FeatureInfo }

type GFeat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>

const SOURCE_ID = 'draw-utils-source'
const LAYER_PREFIX = 'draw-utils-'
let _idCounter = 0
function uid(): string { return `f${++_idCounter}${Date.now().toString(36)}` }

export class MlDrawUtil extends IWebGisDrawBasicUtil {
  declare protected map: MlMap
  private state: DrawState = DrawState.IDLE
  private currentInfo: FeatureInfo | null = null
  private cb: ((f: FeatureInfo) => void) | undefined
  private features = new Map<string | number, FeatureInfo>()
  private fidMap = new Map<string | number, string>()
  private _srcData: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
  private _commitP = false
  private _commitD = false
  private _hlGid: string | null = null

  private stage = -1
  private stageCoords: Coordinate[] = []
  private sketchGid: string | null = null
  private editingId: string | number | null = null

  // drag
  private dragging = false
  private dragStart: [number, number] | null = null
  private dragGid: string | null = null
  private dragVtx = -1
  private _onUp: (() => void) | null = null
  private _onMove: ((e: MouseEvent) => void) | null = null
  private _dragRaf = 0
  private _clickTimes: number[] = []

  constructor(map: MlMap, pickUp: (fs: FeatureInfo[]) => void) {
    super(map, pickUp)
    this.loadIcons()
    const m = map as any
    const init = () => { if (!m._dwInit) { m._dwInit = true; this.initLayers() } }
    if (m.isStyleLoaded()) init(); else m.once('style.load', init)
  }

  // ------------- layers -------------
  private loadIcons(): void {
    for (const c of ['red', 'blue', 'green', 'orange', 'purple']) {
      const u = getBuiltinIcon(c); if (!u) continue
      const img = new Image(); img.src = u
      img.onload = () => { const m = this.map as any; if (m.hasImage(c)) m.updateImage(c, img); else m.addImage(c, img) }
    }
  }

  private initLayers(): void {
    const m = this.map as any
    if (!m.getSource(SOURCE_ID)) m.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    const add = (id: string, def: Record<string, unknown>) => { if (!m.getLayer(id)) m.addLayer({ id, source: SOURCE_ID, ...def }) }
    add(LAYER_PREFIX + 'icon', { type: 'symbol', filter: ['has', 'iconUrl'], layout: { 'icon-image': ['get', 'iconUrl'], 'icon-size': ['case', ['has', 'highlight'], 0.9, 0.6], 'icon-anchor': 'bottom', 'icon-allow-overlap': true } })
    add(LAYER_PREFIX + 'point', { type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['!has', 'owner'], ['!has', 'iconUrl']], paint: { 'circle-radius': ['case', ['has', 'highlight'], 12, 8], 'circle-color': ['get', 'cc'], 'circle-opacity': 0.85, 'circle-stroke-width': ['case', ['has', 'highlight'], 3, 2], 'circle-stroke-color': ['get', 'sc'] } })
    add(LAYER_PREFIX + 'line', { type: 'line', filter: ['all', ['!has', 'owner']], paint: { 'line-width': ['case', ['has', 'highlight'], ['*', ['get', 'lw'], 1.5], ['get', 'lw']], 'line-color': ['get', 'lc'], 'line-dasharray': ['coalesce', ['get', 'da'], ['literal', [1]]] } })
    add(LAYER_PREFIX + 'fill', { type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!has', 'owner']], paint: { 'fill-color': ['get', 'fc'], 'fill-opacity': ['case', ['has', 'highlight'], 0.4, 0.2] } })
    add(LAYER_PREFIX + 'target', { type: 'circle', filter: ['==', ['get', 'owner'], '__edit__'], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#09f' } })
    add(LAYER_PREFIX + 'symbol', { type: 'symbol', filter: ['has', 'label'], layout: { 'text-field': ['get', 'label'], 'text-size': 13, 'text-offset': ['get', 'offx'], 'text-allow-overlap': true }, paint: { 'text-color': ['coalesce', ['get', 'tc'], '#000'], 'text-halo-color': '#fff', 'text-halo-width': 1 } })
  }

  // ------------- commit -------------
  private commit(): void {
    if (this._commitP) { this._commitD = true; return }
    this._commitP = true
    const run = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 0)
    run(() => {
      this._commitP = false
      if (this._commitD) { this._commitD = false; this.commit(); return }
      const s = this.map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      if (s) s.setData(JSON.parse(JSON.stringify({ type: 'FeatureCollection', features: this._srcData.features })))
    })
  }
  private put(f: GFeat): void { const i = this._srcData.features.findIndex((x: any) => x.id === f.id); if (i >= 0) this._srcData.features[i] = f; else this._srcData.features.push(f) }
  private del(gid: string): void { this._srcData.features = this._srcData.features.filter((x: any) => x.id !== gid && (x.properties as any)?.owner !== gid) }
  private putDecs(fs: GFeat[]): void { if (fs.length) this._srcData.features.push(...fs as any) }
  private delDecs(gid: string): void { this._srcData.features = this._srcData.features.filter((f: any) => f.properties?.owner !== gid) }

  // ============ API ============
  click(c: Coordinate): void { if (this.state === DrawState.IDLE) this.doHit(c); else if (this.state === DrawState.CREATING) this.onClick(c) }
  dblclick(c: Coordinate): void { if (this.state === DrawState.IDLE) this.doHit(c); else if (this.state === DrawState.CREATING) this.onDblClick(c); else if (this.state === DrawState.EDITING) this.finishEdit() }
  move(c: Coordinate): void { if (this.state === DrawState.IDLE) this.doHover(c); else if (this.state === DrawState.CREATING && this.stage >= 0) this.updSketch(c) }
  addFeature(i: FeatureInfo): boolean { if (!i.wkt || this.features.has(i.id)) return false; const d = { ...i.detail }; if (!d.name) (d as any).name = generateRandomName(); const g = uid(); this.fidMap.set(i.id, g); this.features.set(i.id, { ...i, detail: d } as FeatureInfo); const gm = this.wktGeo(i.wkt!, i); this.put({ type: 'Feature', id: g, geometry: gm, properties: this.prop(i, d) }); this.addDecor(i, gm.coords(), g); this.commit(); return true }
  modifyFeature(i: FeatureInfo): boolean {
    if (!i.wkt || !this.features.has(i.id)) return false
    if (this.state === DrawState.EDITING) { this.teardownDrag(); this.delTgts(); this.editingId = null; this.state = DrawState.IDLE }
    const g = this.fidMap.get(i.id) || uid(); this.fidMap.set(i.id, g); this.features.set(i.id, { ...i } as FeatureInfo)
    const gm = this.wktGeo(i.wkt!, i)
    this.put({ type: 'Feature', id: g, geometry: gm as any, properties: this.prop(i, i.detail) })
    this.refreshDeco(i, gm.coords(), g); this.commit(); return true
  }
  createFeature(i: FeatureInfo, cb?: (f: FeatureInfo) => void): boolean { if (this.state !== DrawState.IDLE) return false; const d = { ...i.detail }; if (!d.name) (d as any).name = generateRandomName(); this.state = DrawState.CREATING; this.currentInfo = { ...i, detail: d } as FeatureInfo; this.cb = cb; this.stage = -1; this.stageCoords = []; return true }
  updateFeature(i: FeatureInfo, cb?: (f: FeatureInfo) => void): boolean { if (this.state !== DrawState.IDLE || !i.wkt || !this.features.has(i.id)) return false; this.state = DrawState.EDITING; this.currentInfo = { ...i } as FeatureInfo; this.cb = cb; this.editingId = i.id; this.setupDrag(); this.addTgts(); this.commit(); return true }
  deleteFeature(id: string | number, cb?: (f: FeatureInfo) => void): boolean { if (this.state !== DrawState.IDLE) return false; const i = this.features.get(id); if (!i) return false; const g = this.fidMap.get(id)!; this.del(g); this.features.delete(id); this.fidMap.delete(id); this.commit(); cb?.(i); return true }
  clear(cb?: (fs: FeatureInfo[]) => void): boolean { this.teardownDrag(); this.state = DrawState.IDLE; this.stage = -1; this.stageCoords = []; const all = Array.from(this.features.values()); this.features.clear(); this.fidMap.clear(); this._srcData = { type: 'FeatureCollection', features: [] }; this.commit(); cb?.(all); return true }
  getState(): DrawState { return this.state }
  destroy(): void { this.clear(); (this.map as any).remove() }

  // ------------- props -------------
  private prop(info: FeatureInfo, d: any): Record<string, unknown> {
    const t = info.type
    const p: any = { busId: info.id, type: t, lw: d.lineWidth || 2, lc: d.lineRgba || '#000', tc: d.textRgba || '#000' }
    if (d.lineType === 'dashed') p.da = [8, 6]
    if (t === 'point') {
      if (d.iconSrc) { p.iconUrl = d.iconSrc } else { const c = this.pRgba(d.fillRgba || ''); p.cc = `rgba(${c.r},${c.g},${c.b},${c.a ?? 0.7})`; p.sc = `rgba(${c.r},${c.g},${c.b},1)` }
      if (d.name) p.label = d.name
    } else if (t !== 'line' && t !== 'polyline') { p.fc = d.fillRgba || 'rgba(0,0,255,0.2)' }
    return p
  }
  private pRgba(s: string): { r: number; g: number; b: number; a: number } { const m = (s || '').match(/[\d.]+/g); return { r: (m && +m[0]) || 0, g: (m && +m[1]) || 0, b: (m && +m[2]) || 0, a: (m && m[3] != null) ? +m[3] : 1 } }

  // ------------- hit / hover -------------
  private doHit(c: Coordinate): void { const pt = (this.map as any).project([c[0], c[1]]); const hs = (this.map as any).queryRenderedFeatures([[pt.x - 4, pt.y - 4], [pt.x + 4, pt.y + 4]], { layers: [LAYER_PREFIX + 'point', LAYER_PREFIX + 'line', LAYER_PREFIX + 'fill', LAYER_PREFIX + 'icon'] }) || []; const infos: FeatureInfo[] = []; for (const h of hs) { if (h.properties?.busId) { const fi = this.features.get(h.properties.busId); if (fi) infos.push(fi) } } if (infos.length) this.pickUpCallback(infos) }
  private doHover(c: Coordinate): void { const pt = (this.map as any).project([c[0], c[1]]); const hs = (this.map as any).queryRenderedFeatures([[pt.x - 2, pt.y - 2], [pt.x + 2, pt.y + 2]], { layers: [LAYER_PREFIX + 'point', LAYER_PREFIX + 'line', LAYER_PREFIX + 'fill', LAYER_PREFIX + 'icon'] }) || []; let ng: string | null = null; for (const h of hs) { const bi = (h.properties as any)?.busId; if (!bi || (h.properties as any)?.owner) continue; ng = this.fidMap.get(bi) || null; break } if (ng === this._hlGid) return; if (this._hlGid) { const f = this._srcData.features.find((x: any) => x.id === this._hlGid); if (f?.properties) delete f.properties.highlight } this._hlGid = ng; if (ng) { const f = this._srcData.features.find((x: any) => x.id === ng); if (f?.properties) f.properties.highlight = true } this.commit() }

  // ============ 新建绘制 ============
  private tp(): FeatureType { return this.currentInfo!.type }
  private onClick(c: Coordinate): void { const t = this.tp(); if (t === 'triangle' && this.stage === 0) { this.stageCoords.push([...c]); this.stage = 1; this._clickTimes.push(Date.now()); this.updSketch(c) } else if ((t === 'polyline' || t === 'customShape') && this.stage >= 0) { this.stageCoords.push([...c]); this._clickTimes.push(Date.now()); this.updSketch(c) } }
  private onDblClick(c: Coordinate): void {
    if (this.state !== DrawState.CREATING || !this.currentInfo) return
    const now = Date.now(); let rolled = 0
    for (let i = this._clickTimes.length - 1; i >= 0; i--) { if (now - this._clickTimes[i] < 400) { rolled++; this.stageCoords.pop() } }
    this._clickTimes = []; if (this.tp() === 'triangle' && rolled > 0) this.stage = 0
    const t = this.tp(); const [lng, lat] = c
    if (t === 'point') { this.doFinish([lng, lat]); return }
    if (this.stage === -1) { this.stageCoords.push([lng, lat]); this.stage = 0; this.updSketch(c); return }
    const need2 = (t === 'line' || t === 'rect') && this.stageCoords.length === 1
    const needCircle = t === 'circle' && this.stageCoords.length === 1
    const need3 = (t === 'triangle' || t === 'polyline' || t === 'customShape')
    if (need2 || needCircle) { this.stageCoords.push([lng, lat]); this.doFinish([lng, lat]); return }
    if (need3 && this.stageCoords.length >= 2) { this.stageCoords.push([lng, lat]); this.doFinish([lng, lat]); return }
    this.resetSketch()
  }
  private updSketch(c: Coordinate): void {
    const t = this.tp(); let coords: Coordinate[]; let geom: any
    if (t === 'line') { coords = [...this.stageCoords, c]; geom = { type: 'LineString', coordinates: coords } }
    else if (t === 'rect' && this.stageCoords.length >= 1) { coords = rectCoordsFromDiagonal(this.stageCoords[0], c); geom = { type: 'Polygon', coordinates: [coords] } }
    else if (t === 'triangle') { const n2 = this.stageCoords.length === 1; coords = n2 ? [...this.stageCoords, c] : [...this.stageCoords, c, this.stageCoords[0]]; geom = n2 ? { type: 'LineString', coordinates: coords } : { type: 'Polygon', coordinates: [coords] } }
    else if (t === 'circle' && this.stageCoords.length >= 1) { coords = generateCircleCoords(this.stageCoords[0], haversineDistance(this.stageCoords[0], c)); geom = { type: 'Polygon', coordinates: [coords] } }
    else if (t === 'polyline') { coords = [...this.stageCoords, c]; geom = { type: 'LineString', coordinates: coords } }
    else if (t === 'customShape') { coords = [...this.stageCoords, c, this.stageCoords[0]]; geom = { type: 'LineString', coordinates: coords } }
    else return
    if (this.sketchGid) this.del(this.sketchGid)
    this.sketchGid = uid()
    const p: any = { lw: 2, lc: 'rgba(255,0,0,0.6)', cc: 'rgba(255,0,0,0.7)', sc: 'rgba(255,0,0,1)' }
    if (this.currentInfo && (this.currentInfo.detail as any).iconSrc && this.tp() === 'point') p.iconUrl = (this.currentInfo.detail as any).iconSrc
    if (geom.type === 'Polygon') p.fc = 'rgba(255,0,0,0.1)'
    this.put({ type: 'Feature', id: this.sketchGid, geometry: geom, properties: p })
    this.delDecs('__sketch__'); if (this.currentInfo) this.addDecor(this.currentInfo, coords, '__sketch__')
    this.commit()
  }
  private resetSketch(): void { if (this.sketchGid) { this.del(this.sketchGid); this.sketchGid = null } this.delDecs('__sketch__'); this.stage = -1; this.stageCoords = []; this.state = DrawState.IDLE; this.currentInfo = null; this.cb = undefined; const s = this.map.getSource(SOURCE_ID) as GeoJSONSource | undefined; if (s) s.setData(JSON.parse(JSON.stringify({ type: 'FeatureCollection', features: this._srcData.features }))) }
  private doFinish(fc: Coordinate): void {
    const t = this.tp(); let coords: Coordinate[]; let wkt: string
    if (t === 'point') { coords = [fc]; wkt = buildWkt('Point', coords) }
    else if (t === 'line') { coords = [this.stageCoords[0], this.stageCoords[1]]; wkt = buildWkt('LineString', coords) }
    else if (t === 'rect') { coords = rectCoordsFromDiagonal(this.stageCoords[0], this.stageCoords[1]); wkt = buildWkt('Polygon', coords) }
    else if (t === 'triangle') { coords = [...this.stageCoords, this.stageCoords[0]]; wkt = buildWkt('Polygon', coords) }
    else if (t === 'circle') { const c2 = this.stageCoords[0]; const r = haversineDistance(c2, this.stageCoords[1]); coords = generateCircleCoords(c2, r); wkt = buildWkt('Point', [c2]); const info = { ...this.currentInfo!, wkt, detail: { ...this.currentInfo!.detail, radius: Math.round(r) } } as FeatureInfo; this.persist(t, coords, wkt, info); return }
    else if (t === 'polyline') { coords = this.stageCoords; wkt = buildWkt('LineString', coords) }
    else { coords = [...this.stageCoords, this.stageCoords[0]]; wkt = buildWkt('Polygon', coords) }
    this.persist(t, coords, wkt, { ...this.currentInfo!, wkt } as FeatureInfo)
  }
  private persist(type: string, coords: Coordinate[], wkt: string, info: FeatureInfo): void {
    if (this.sketchGid) { this.del(this.sketchGid); this.sketchGid = null }
    this.delDecs('__sketch__')
    const g = uid(); this.fidMap.set(info.id, g); this.features.set(info.id, info)
    const geom = type === 'point' ? { type: 'Point', coordinates: coords[0] } : type === 'line' || type === 'polyline' ? { type: 'LineString', coordinates: coords } : { type: 'Polygon', coordinates: [coords] }
    this.put({ type: 'Feature', id: g, geometry: geom as any, properties: this.prop(info, info.detail) })
    this.addDecor(info, coords, g); this.cb?.(info as FeatureInfo); this.commit(); this.resetIdle()
  }

  // ============ 装饰 ============
  private addDecor(info: FeatureInfo, coords: Coordinate[], gid: string): void {
    const t = info.type; const dec: GFeat[] = []
    // 面积
    if (t !== 'line' && t !== 'polyline' && t !== 'point') { const a = sphericalArea(coords); if (a > 0) { const n = coords.length - 1; let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1] } cx /= n; cy /= n; dec.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [cx, cy] }, properties: { label: a >= 1e6 ? `${(a / 1e6).toFixed(2)} km²` : `${a.toFixed(2)} m²`, owner: gid, isArea: true, offx: [1.5, 0] } }) } }
    // 半径 / 边长
    if (t === 'circle') { const n = coords.length - 1; let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1] } cx /= n; cy /= n; const r = haversineDistance([cx, cy], coords[0]); dec.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: { label: this.fmtL(r), owner: gid, offx: [0, -1.5] } }) }
    else if (t !== 'point') { for (let i = 0; i < coords.length - 1; i++) { const d = haversineDistance(coords[i], coords[i + 1]); if (d <= 0) continue; dec.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [(coords[i][0] + coords[i + 1][0]) / 2, (coords[i][1] + coords[i + 1][1]) / 2] }, properties: { label: this.fmtL(d), owner: gid, offx: [0, 0] } }) } }
    // name
    if (gid !== '__sketch__' && info.detail.name) { const n = t === 'polyline' || t === 'line' ? coords.length : coords.length - 1; let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1] } cx /= n; cy /= n; dec.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [cx, cy] }, properties: { label: info.detail.name as string, tc: (info.detail as any).textRgba || '#000', owner: gid, offx: [0, 1.5] } }) }
    // icon
    if (gid !== '__sketch__' && (info.detail as any).iconSrc && t !== 'point') { const n = t === 'polyline' || t === 'line' ? coords.length : coords.length - 1; let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += coords[i][0]; cy += coords[i][1] } cx /= n; cy /= n; const src = (info.detail as any).iconSrc as string; const iconUrl = src.includes('://') || src.includes('/') ? src : src; dec.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [cx, cy] }, properties: { iconUrl, owner: gid, offx: [0, -1.5] } }) }
    this.putDecs(dec)
  }
  private refreshDeco(info: FeatureInfo, coords: Coordinate[], gid: string): void { this.delDecs(gid); this.addDecor(info, coords, gid) }
  private fmtL(m: number): string { return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(2)} m` }

  // ============ 编辑拖拽 ============
  private setupDrag(): void { this.teardownDrag(); const cvs = this.map.getCanvas(); cvs.style.cursor = 'crosshair'; const dn = (e: MouseEvent) => this.dragStartFn(e); cvs.addEventListener('mousedown', dn, true); (this as any)._dn = dn }
  private clnDrag(): void { if (this._onMove) { document.removeEventListener('mousemove', this._onMove); this._onMove = null } if (this._onUp) { document.removeEventListener('mouseup', this._onUp); this._onUp = null } ;(this.map as any).dragPan?.enable(); (this.map as any).scrollZoom?.enable() }
  private teardownDrag(): void { this.clnDrag(); if ((this as any)._dn) { this.map.getCanvas().removeEventListener('mousedown', (this as any)._dn, true); (this as any)._dn = null } this.map.getCanvas().style.cursor = '' }

  private dragStartFn(e: MouseEvent): void {
    const gid = this.fidMap.get(this.editingId!); if (!gid) return
    const r = this.map.getCanvas().getBoundingClientRect()
    const mx = e.clientX - r.left; const my = e.clientY - r.top
    const tgtHits = (this.map as any).queryRenderedFeatures([[mx - 10, my - 10], [mx + 10, my + 10]], { layers: [LAYER_PREFIX + 'target'] }) || []
    const mainHits = (this.map as any).queryRenderedFeatures([[mx - 4, my - 4], [mx + 4, my + 4]], { layers: [LAYER_PREFIX + 'point', LAYER_PREFIX + 'line', LAYER_PREFIX + 'fill'] }) || []
    if (tgtHits.length === 0 && !mainHits.find((h: any) => h.properties?.busId === this.editingId)) return
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    ;(this.map as any).dragPan?.disable(); (this.map as any).scrollZoom?.disable()
    this.dragging = true; this.dragGid = gid; this.dragVtx = -1
    const f = this._srcData.features.find((x: any) => x.id === gid); const t2 = this.currentInfo?.type

    // 靶点优先：解析 _tN 后缀区分顶点/边中点
    if (tgtHits.length > 0 && f?.geometry) {
      const g2 = f.geometry as any
      let vc = 0
      if (g2.type === 'Point') vc = 1
      else if (g2.type === 'LineString') vc = g2.coordinates.length
      else if (g2.type === 'Polygon') vc = (g2.coordinates[0] as number[][]).length - 1
      for (const tgt of tgtHits) {
        const idx = (tgt.properties as any)?.tgIdx
        if (idx != null) { this.dragVtx = idx; break }
      }
    }
    // 未命中靶点，扫描最近顶点（圆形除外：非靶点只能整体平移）
    if (this.dragVtx < 0 && f?.geometry && t2 !== 'circle') {
      const pts: any[] = []; const g2 = f.geometry as any
      if (g2.type === 'Point') pts.push(g2.coordinates)
      else if (g2.type === 'LineString') pts.push(...g2.coordinates)
      else if (g2.type === 'Polygon') (g2.coordinates[0] as number[][]).forEach((p: number[]) => pts.push(p))
      let minD = Infinity
      for (let i = 0; i < pts.length; i++) { const cp = (this.map as any).project(pts[i]); const d = Math.hypot(cp.x - mx, cp.y - my);         if (d < 12 && d < minD) { minD = d; this.dragVtx = i } }
    }
    // 折线/自定义：点击边插入顶点
    if (this.dragVtx < 0 && f?.geometry && (t2 === 'polyline' || t2 === 'customShape')) {
      const g2 = f.geometry as any; let allPts: [number, number][] = []
      if (g2.type === 'LineString') allPts = g2.coordinates
      else if (g2.type === 'Polygon') allPts = g2.coordinates[0] as [number, number][]
      let bestI = -1, bestT = 0, bestD = 30
      const cp = (this.map as any).unproject([mx, my])
      for (let i = 0; i < allPts.length - 1; i++) {
        const a = allPts[i], b = allPts[i + 1]
        const abx = b[0] - a[0], aby = b[1] - a[1]
        const l2 = abx * abx + aby * aby; if (l2 === 0) continue
        let t = ((cp.lng - a[0]) * abx + (cp.lat - a[1]) * aby) / l2
        if (t < 0) t = 0; if (t > 1) t = 1
        const pl = a[0] + t * abx, pt2 = a[1] + t * aby
        const pp = (this.map as any).project([pl, pt2])
        const d = Math.hypot(pp.x - mx, pp.y - my)
        if (d < bestD) { bestD = d; bestI = i; bestT = t }
      }
      if (bestI >= 0) {
        const a = allPts[bestI], b = allPts[bestI + 1]
        const nl = a[0] + bestT * (b[0] - a[0]), nlt = a[1] + bestT * (b[1] - a[1])
        if (g2.type === 'LineString') { g2.coordinates.splice(bestI + 1, 0, [nl, nlt]); this.dragVtx = bestI + 1 }
        else if (g2.type === 'Polygon') { const ring = g2.coordinates[0] as number[][]; ring.splice(bestI + 1, 0, [nl, nlt]); this.dragVtx = bestI + 1 }
        this.addTgts()
      }
    }
    const ll = (this.map as any).unproject([mx, my]); this.dragStart = [ll.lng, ll.lat]
    this._onMove = (ev: MouseEvent) => { ev.preventDefault(); this.dragMove(ev) }
    this._onUp = () => { this.dragging = false; this.dragStart = null; this.dragGid = null; this.dragVtx = -1; this.clnDrag() }
    document.addEventListener('mousemove', this._onMove, { passive: false }); document.addEventListener('mouseup', this._onUp)
  }

  private dragMove(e: MouseEvent): void {
    if (!this.dragging || !this.dragStart || !this.dragGid) return
    const r2 = this.map.getCanvas().getBoundingClientRect()
    const ll = (this.map as any).unproject([e.clientX - r2.left, e.clientY - r2.top])
    const dx = ll.lng - this.dragStart[0]; const dy = ll.lat - this.dragStart[1]; this.dragStart = [ll.lng, ll.lat]
    const f = this._srcData.features.find((x: any) => x.id === this.dragGid); if (!f?.geometry) return
    const g = f.geometry as any; const t = this.currentInfo?.type
    if (this.dragVtx >= 0) {
      if (t === 'circle' && g.type === 'Polygon') {
        const ring = g.coordinates[0]; const n = ring.length - 1
        let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1] }; cx /= n; cy /= n
        let ri = 0, rl = -Infinity; for (let i = 0; i < n; i++) { if (ring[i][0] > rl) { rl = ring[i][0]; ri = i } }
        ring[ri][0] += dx; ring[ri][1] += dy
        const r = haversineDistance([cx, cy], [ring[ri][0], ring[ri][1]])
        const nc = generateCircleCoords([cx, cy], r)
        for (let i = 0; i <= n; i++) { ring[i][0] = nc[i][0]; ring[i][1] = nc[i][1] }
      } else if (g.type === 'Point') { g.coordinates[0] += dx; g.coordinates[1] += dy }
      else if (g.type === 'LineString') {
        if (this.dragVtx >= g.coordinates.length) { g.coordinates.forEach((c: number[]) => { c[0] += dx; c[1] += dy }) }
        else { const c = g.coordinates[this.dragVtx]; if (c) { c[0] += dx; c[1] += dy } }
      }
      else if (g.type === 'Polygon') {
        const ring = g.coordinates[0]; const n = ring.length - 1; const idx = this.dragVtx
        if (idx >= n) {
          // 边中点拖拽：平移该边两端点 + 重建矩形
          const ei = idx - n; const ej = (ei + 1) % n
          if (ring[ei] && ring[ej]) { ring[ei][0] += dx; ring[ei][1] += dy; ring[ej][0] += dx; ring[ej][1] += dy }
          if ((t === 'rect' || t === 'triangle') && ei === 0) { ring[n][0] = ring[0][0]; ring[n][1] = ring[0][1] }
          if (t === 'rect' && ring.length >= 5) {
            const opp = (ei + 2) % 4
            const rc = rectCoordsFromDiagonal([ring[ei][0], ring[ei][1]] as [number, number], [ring[opp][0], ring[opp][1]] as [number, number])
            for (let i = 0; i < 4; i++) { ring[i][0] = rc[i][0]; ring[i][1] = rc[i][1] }
            ring[4][0] = rc[0][0]; ring[4][1] = rc[0][1]
          }
        } else if (ring[idx]) {
          ring[idx][0] += dx; ring[idx][1] += dy
          if (t === 'rect' && ring.length >= 5) {
            const opp = (idx + 2) % 4
            const rc = rectCoordsFromDiagonal([ring[idx][0], ring[idx][1]] as [number, number], [ring[opp][0], ring[opp][1]] as [number, number])
            for (let i = 0; i < 4; i++) { ring[i][0] = rc[i][0]; ring[i][1] = rc[i][1] }
            ring[4][0] = rc[0][0]; ring[4][1] = rc[0][1]
          }
          if (t === 'triangle' && ring.length === 4 && (idx === 0 || idx === 2)) { ring[3][0] = ring[0][0]; ring[3][1] = ring[0][1] }
        }
      }
    } else {
      if (g.type === 'Point') { g.coordinates[0] += dx; g.coordinates[1] += dy }
      else if (t === 'circle' && g.type === 'Polygon') {
        const ring = g.coordinates[0]; const n = ring.length - 1
        let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1] }; cx /= n; cy /= n
        const nc = generateCircleCoords([cx + dx, cy + dy], haversineDistance([cx, cy], ring[0]))
        for (let i = 0; i <= n; i++) { ring[i][0] = nc[i][0]; ring[i][1] = nc[i][1] }
      }
      else if (g.type === 'LineString') g.coordinates.forEach((c: number[]) => { c[0] += dx; c[1] += dy })
      else if (g.type === 'Polygon') g.coordinates.forEach((r: number[][]) => r.forEach((c: number[]) => { c[0] += dx; c[1] += dy }))
    }
    this.updTgts()
    if (!this._dragRaf) this._dragRaf = requestAnimationFrame(() => {
      this._dragRaf = 0
      const owner = String(this.dragGid!)
      this.delDecs(owner)
      if (this.currentInfo) {
        const gf2 = this._srcData.features.find((x: any) => x.id === this.dragGid)?.geometry as any
        if (gf2) {
          const coords2: Coordinate[] = gf2.type === 'Polygon' ? gf2.coordinates[0] : gf2.type === 'LineString' ? gf2.coordinates : [gf2.coordinates]
          this.addDecor(this.currentInfo, coords2, owner)
        }
      }
      this.commit()
    })
  }

  private finishEdit(): void {
    this.teardownDrag(); this.dragging = false; this.delTgts()
    if (!this.currentInfo || !this.editingId) { this.resetIdle(); return }
    const gid = this.fidMap.get(this.editingId); if (!gid) { this.resetIdle(); return }
    const f = this._srcData.features.find((x: any) => x.id === gid); if (!f?.geometry) { this.resetIdle(); return }
    const wkt = this.gWkt(f.geometry as any); const info = { ...this.currentInfo, wkt } as FeatureInfo
    this.features.set(info.id, info)
    const gf = f.geometry as any
    const coords: Coordinate[] = gf.type === 'Polygon' ? gf.coordinates[0] : gf.type === 'LineString' ? gf.coordinates : [gf.coordinates]
    this.refreshDeco(info, coords, gid); this.cb?.(info); this.commit(); this.resetIdle()
  }
  private gWkt(g: any): string { if (g.type === 'Point') return `POINT(${g.coordinates[0]} ${g.coordinates[1]})`; if (g.type === 'LineString') return `LINESTRING(${g.coordinates.map((c: number[]) => `${c[0]} ${c[1]}`).join(',')})`; return `POLYGON((${g.coordinates[0].map((c: number[]) => `${c[0]} ${c[1]}`).join(',')}))` }

  // ------------- targets -------------
  private addTgts(): void {
    const gid = this.fidMap.get(this.editingId!); if (!gid) return
    const f = this._srcData.features.find((x: any) => x.id === gid); if (!f?.geometry) return
    const t = this.currentInfo?.type; const g = f.geometry as any; const pts: [number, number][] = []
    if (t === 'circle') { const ring = g.coordinates[0]; const n = ring.length - 1; let ri = 0, rl = -Infinity; for (let i = 0; i < n; i++) { if (ring[i][0] > rl) { rl = ring[i][0]; ri = i } } pts.push(ring[ri]) }
    else if (g.type === 'Point') { pts.push(g.coordinates) }
    else if (g.type === 'LineString') { pts.push(...g.coordinates); if (g.coordinates.length === 2) pts.push([(g.coordinates[0][0] + g.coordinates[1][0]) / 2, (g.coordinates[0][1] + g.coordinates[1][1]) / 2]) }
    else if (g.type === 'Polygon') { const ring = g.coordinates[0]; const n = ring.length - 1; for (let i = 0; i < n; i++) pts.push(ring[i]); if (t === 'rect' || t === 'triangle') for (let i = 0; i < n; i++) { const j = (i + 1) % n; pts.push([(ring[i][0] + ring[j][0]) / 2, (ring[i][1] + ring[j][1]) / 2]) } }
    let ti = 0; for (const p of pts) { this.put({ type: 'Feature', id: `${gid}_t${ti}`, geometry: { type: 'Point', coordinates: p }, properties: { owner: '__edit__', editGid: gid, tgIdx: ti++ } }) }
  }
  private delTgts(): void { this._srcData.features = this._srcData.features.filter((x: any) => (x.properties as any)?.owner !== '__edit__') }
  private updTgts(): void {
    const gid = this.fidMap.get(this.editingId!); if (!gid) return
    const f = this._srcData.features.find((x: any) => x.id === gid); if (!f?.geometry) return
    const t = this.currentInfo?.type; const g = f.geometry as any; const pts: [number, number][] = []
    if (t === 'circle') { const ring = g.coordinates[0]; const n = ring.length - 1; let ri = 0, rl = -Infinity; for (let i = 0; i < n; i++) { if (ring[i][0] > rl) { rl = ring[i][0]; ri = i } } pts.push(ring[ri]) }
    else if (g.type === 'Point') { pts.push(g.coordinates) }
    else if (g.type === 'LineString') { pts.push(...g.coordinates); if (g.coordinates.length === 2) pts.push([(g.coordinates[0][0] + g.coordinates[1][0]) / 2, (g.coordinates[0][1] + g.coordinates[1][1]) / 2]) }
    else if (g.type === 'Polygon') { const ring = g.coordinates[0]; const n = ring.length - 1; for (let i = 0; i < n; i++) pts.push(ring[i]); if (t === 'rect' || t === 'triangle') for (let i = 0; i < n; i++) { const j = (i + 1) % n; pts.push([(ring[i][0] + ring[j][0]) / 2, (ring[i][1] + ring[j][1]) / 2]) } }
    const tgts = this._srcData.features.filter((x: any) => (x.properties as any)?.owner === '__edit__' && (x.properties as any)?.editGid === gid)
    for (let i = 0; i < Math.min(tgts.length, pts.length); i++) { (tgts[i] as any).geometry.coordinates = pts[i] }
  }

  // ------------- WKT -------------
  private wktGeo(wkt: string, info: FeatureInfo): any { if (info.type === 'circle') { const m = wkt.match(/POINT\(([\d.]+)\s+([\d.]+)\)/); if (m) { const c: [number, number] = [parseFloat(m[1]), parseFloat(m[2])]; const r = (info.detail as any).radius || 500; const cs = generateCircleCoords(c, r); return { type: 'Polygon', coordinates: [cs], coords: () => cs } } } const g = this.pWkt(wkt); g.coords = function (this: any) { if (this.type === 'Point') return [this.coordinates]; if (this.type === 'LineString') return this.coordinates; return this.coordinates[0] }; return g }
  private pWkt(w: string): any { let m = w.match(/POINT\(([\d.]+)\s+([\d.]+)\)/); if (m) return { type: 'Point', coordinates: [parseFloat(m[1]), parseFloat(m[2])] }; m = w.match(/LINESTRING\((.+)\)/); if (m) return { type: 'LineString', coordinates: m[1].split(',').map((p: string) => { const [x, y] = p.trim().split(/\s+/); return [parseFloat(x), parseFloat(y)] }) }; m = w.match(/POLYGON\(\((.+)\)\)/); if (m) return { type: 'Polygon', coordinates: [m[1].split(',').map((p: string) => { const [x, y] = p.trim().split(/\s+/); return [parseFloat(x), parseFloat(y)] })] }; return { type: 'Point', coordinates: [0, 0] } }
  private resetIdle(): void { this.state = DrawState.IDLE; this.currentInfo = null; this.cb = undefined; this.stage = -1; this.stageCoords = []; this.teardownDrag(); this.delTgts(); this.editingId = null }
}
