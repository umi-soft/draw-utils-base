import { describe, it, expect } from 'vitest'
import { MlDrawUtil } from '../src/index'
import { DrawState } from '@loongbao-web-gis-utils/draw-utils-base-core'
import type { FeatureInfo } from '@loongbao-web-gis-utils/draw-utils-base-core'

function createMockMap() {
  const sources: Record<string, any> = {}
  const layers: string[] = []
    const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0 } } }
  return {
    map: {
      getSource(id: string) { return sources[id] || { setData() {}, _data: { type: 'FeatureCollection', features: [] } } },
      addSource(id: string, opts: any) { sources[id] = opts },
      getLayer(id: string) { return layers.includes(id) ? { id } : null },
      addLayer() {},
      getCanvas() { return canvas },
      isStyleLoaded() { return true },
      on() {},
      once() {},
      remove() {},
      project() { return { x: 0, y: 0 } },
      unproject() { return { lng: 0, lat: 0 } },
      queryRenderedFeatures() { return [] },
      dragPan: { enable() {}, disable() {} },
      scrollZoom: { enable() {}, disable() {} },
    } as unknown,
  }
}

describe('MlDrawUtil', () => {
  it('应正确继承 IWebGisDrawBasicUtil', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new MlDrawUtil(map, cb)
    expect(util).toBeInstanceOf(MlDrawUtil)
    expect(util.getState()).toBe(DrawState.IDLE)
  })

  it('destroy 可安全调用', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new MlDrawUtil(map, cb)
    expect(() => util.destroy()).not.toThrow()
  })

  it('createFeature 进入 CREATING', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new MlDrawUtil(map, cb)
    const r = util.createFeature({ id: 't1', type: 'point', detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' } })
    expect(r).toBe(true)
    expect(util.getState()).toBe(DrawState.CREATING)
  })

  it('非 IDLE 下 createFeature 返回 false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new MlDrawUtil(map, cb)
    util.createFeature({ id: 'a', type: 'point', detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' } })
    expect(util.createFeature({ id: 'b', type: 'point', detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' } })).toBe(false)
  })
})
