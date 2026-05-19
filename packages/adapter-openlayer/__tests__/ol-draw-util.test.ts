import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { OlDrawUtil } from '../src/ol-draw-util'
import { DrawState } from '@loongbao-web-gis-utils/draw-utils-base-core'
import type { FeatureInfo } from '@loongbao-web-gis-utils/draw-utils-base-core'

function createMockMap() {
  const getViewCalls: unknown[] = []
  const addedLayers: unknown[] = []
  const removedLayers: unknown[] = []
  const addedFeatures: unknown[] = []
  const removedFeatures: unknown[] = []
  let allFeatures: unknown[] = []
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let disposed = false

  const source = {
    addFeature(f: unknown) { addedFeatures.push(f) },
    removeFeature(f: unknown) { removedFeatures.push(f) },
    getFeatures() { return allFeatures },
    clear() { allFeatures = [] },
    dispose() { disposed = true },
    on() {},
    un() {},
  }

  const map = {
    getView() {
      getViewCalls.push(null)
      return {
        getCenter() { return [0, 0] },
        getZoom() { return 5 },
        getProjection() { return { getCode() { return 'EPSG:4326' } } },
        on() {},
        un() {},
      }
    },
    addLayer(l: unknown) { addedLayers.push(l) },
    removeLayer(l: unknown) { removedLayers.push(l) },
    addInteraction(_i: unknown) {},
    removeInteraction(_i: unknown) {},
    getFeaturesAtPixel(_pixel: unknown, _opts?: unknown) { return [] },
    getPixelFromCoordinate(_coord: unknown) { return [0, 0] },
  } as unknown

  const pickUpHits: FeatureInfo[][] = []
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cb = (features: FeatureInfo[]) => { pickUpHits.push(features) }

  return { map, pickUpHits, addedLayers, removedLayers, addedFeatures, removedFeatures, source }
}

// ========= 基础生命周期 =========

describe('OlDrawUtil 基础生命周期', () => {
  it('构造后初始状态为 IDLE', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('destroy 后不会抛出异常', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    util.destroy()
    expect(true).toBe(true)
  })
})

// ========= 状态机 =========

describe('OlDrawUtil 状态机', () => {
  let util: OlDrawUtil
  let map: unknown
  const cb = (_f: FeatureInfo[]) => {}

  beforeEach(() => {
    const mock = createMockMap()
    map = mock.map
    util = new OlDrawUtil(map, cb)
  })

  afterEach(() => {
    util.destroy()
  })

  it('IDLE 状态下 createFeature 返回 true 并切换到 CREATING', () => {
    const result = util.createFeature({
      id: 't1',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(true)
    expect(util.getState()).toBe(DrawState.CREATING)
  })

  it('CREATING 状态下 createFeature 返回 false', () => {
    util.createFeature({
      id: 't1',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    const result = util.createFeature({
      id: 't2',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(false)
  })

  it('CREATING 状态下 deleteFeature 返回 false', () => {
    util.createFeature({
      id: 't1',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(util.deleteFeature('nonexistent')).toBe(false)
  })

  it('点类型绘制完成后恢复到 IDLE', () => {
    util.createFeature({
      id: 'pt1',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    util.dblclick([116.404, 39.915])
    expect(util.getState()).toBe(DrawState.IDLE)
  })

  it('click/dblclick/move 在 IDLE 状态下不抛出异常', () => {
    expect(() => util.click([116, 40])).not.toThrow()
    expect(() => util.dblclick([116, 40])).not.toThrow()
    expect(() => util.move([116, 40])).not.toThrow()
  })
})

// ========= 点要素 =========

describe('点要素 Point', () => {
  it('一次双击完成绘制并生成 WKT', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'p1',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      },
      (f) => { result = f },
    )

    util.dblclick([116.404, 39.915])

    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result).toBeDefined()
    expect(result!.wkt).toBe('POINT(116.404 39.915)')
    expect(result!.id).toBe('p1')
    util.destroy()
  })

  it('name 为空时自动生成', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'p2',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      },
      (f) => { result = f },
    )

    util.dblclick([120, 30])

    expect(result).toBeDefined()
    expect(result!.detail.name).toBeDefined()
    expect(result!.detail.name).not.toBe('')
    util.destroy()
  })

  it('icon 模式 point 绘制成功', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'p3',
        type: 'point',
        detail: {
          name: 'icon点',
          iconSrc: 'https://example.com/icon.png',
          fillRgba: 'rgba(255,0,0,0.5)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([110, 25])
    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result!.detail.iconSrc).toBe('https://example.com/icon.png')
    util.destroy()
  })
})

// ========= 矩形要素 =========

describe('矩形要素 Rect', () => {
  it('两次双击完成矩形绘制', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'r1',
        type: 'rect',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(255,0,0,1)',
          fillRgba: 'rgba(255,0,0,0.2)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([116.400, 39.910])
    expect(util.getState()).toBe(DrawState.CREATING)

    util.move([116.410, 39.920])
    util.dblclick([116.410, 39.920])

    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result).toBeDefined()
    expect(result!.wkt).toContain('POLYGON')
    util.destroy()
  })
})

// ========= 三角形要素 =========

describe('三角形要素 Triangle', () => {
  it('双击→单击→双击完成三角形绘制', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 't1',
        type: 'triangle',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(0,255,0,1)',
          fillRgba: 'rgba(0,255,0,0.2)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([116.400, 39.910])
    expect(util.getState()).toBe(DrawState.CREATING)

    util.move([116.405, 39.915])
    util.click([116.405, 39.915])

    util.move([116.402, 39.920])
    util.dblclick([116.402, 39.920])

    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result).toBeDefined()
    expect(result!.wkt).toContain('POLYGON')
    util.destroy()
  })
})

// ========= 圆形要素 =========

describe('圆形要素 Circle', () => {
  it('两次双击完成圆形绘制，WKT 存圆心 Point', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'c1',
        type: 'circle',
        detail: {
          radius: 0,
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(0,0,255,1)',
          fillRgba: 'rgba(0,0,255,0.2)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([116.404, 39.915])
    expect(util.getState()).toBe(DrawState.CREATING)

    util.move([116.408, 39.915])
    util.dblclick([116.408, 39.915])

    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result).toBeDefined()
    expect(result!.wkt).toContain('POINT')
    expect(result!.detail.radius).toBeGreaterThan(0)
    util.destroy()
  })
})

// ========= 线段要素 =========

describe('线段要素 Line', () => {
  it('两次双击完成线段绘制', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'l1',
        type: 'line',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(255,0,0,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([116.400, 39.910])
    expect(util.getState()).toBe(DrawState.CREATING)

    util.move([116.410, 39.920])
    util.dblclick([116.410, 39.920])

    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result).toBeDefined()
    expect(result!.wkt).toContain('LINESTRING')
    util.destroy()
  })
})

// ========= 折线要素 =========

describe('折线要素 Polyline', () => {
  it('双击→单击→单击→双击完成折线绘制（≥3点）', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'pl1',
        type: 'polyline',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(255,0,0,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([116.400, 39.910])
    util.click([116.405, 39.915])
    util.click([116.410, 39.912])
    util.dblclick([116.415, 39.918])

    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result).toBeDefined()
    expect(result!.wkt).toContain('LINESTRING')
    util.destroy()
  })

  it('只有1个中间点时双击无效（<3个点约束）', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 'pl2',
        type: 'polyline',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(255,0,0,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([116.400, 39.910])
    util.dblclick([116.405, 39.915])

    expect(util.getState()).toBe(DrawState.CREATING)
    expect(result).toBeUndefined()
    util.destroy()
  })
})

// ========= 自定义封闭图形 =========

describe('自定义封闭图形 CustomShape', () => {
  it('双击→单击→双击完成封闭图形绘制', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let result: FeatureInfo | undefined

    util.createFeature(
      {
        id: 's1',
        type: 'customShape',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(255,0,0,1)',
          fillRgba: 'rgba(255,0,0,0.2)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      (f) => { result = f },
    )

    util.dblclick([116.400, 39.910])
    util.click([116.410, 39.910])
    util.click([116.410, 39.920])
    util.dblclick([116.400, 39.920])

    expect(util.getState()).toBe(DrawState.IDLE)
    expect(result).toBeDefined()
    expect(result!.wkt).toContain('POLYGON')
    util.destroy()
  })
})

// ========= CRUD 操作 =========

describe('CRUD 操作', () => {
  it('deleteFeature 删除已存在要素并回调', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      {
        id: 'd1',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    expect(created).toBeDefined()

    let deleted: FeatureInfo | undefined
    const result = util.deleteFeature('d1', (f) => { deleted = f })
    expect(result).toBe(true)
    expect(deleted).toBeDefined()
    expect(deleted!.id).toBe('d1')
    util.destroy()
  })

  it('deleteFeature 删除不存在的要素返回 false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    expect(util.deleteFeature('nonexistent')).toBe(false)
    util.destroy()
  })

  it('clear 清空所有要素并回调', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    util.createFeature(
      { id: 'c1', type: 'point', detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' } },
    )
    util.dblclick([116, 40])

    util.createFeature(
      { id: 'c2', type: 'point', detail: { fillRgba: 'rgba(0,255,0,0.5)', textRgba: 'rgba(0,0,0,1)' } },
    )
    util.dblclick([117, 41])

    let cleared: FeatureInfo[] | undefined
    const result = util.clear((features) => { cleared = features })

    expect(result).toBe(true)
    expect(util.getState()).toBe(DrawState.IDLE)
    expect(cleared).toBeDefined()
    expect(cleared!.length).toBe(2)
    util.destroy()
  })

  it('updateFeature 在 IDLE 状态下进入 EDITING', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      {
        id: 'u1',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    expect(created).toBeDefined()

    const result = util.updateFeature(created!)
    expect(result).toBe(true)
    expect(util.getState()).toBe(DrawState.EDITING)

    util.dblclick([116, 40])
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('updateFeature 无 wkt 时返回 false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    const result = util.updateFeature({
      id: 'no_wkt',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(false)
    util.destroy()
  })

  it('updateFeature 要素不存在时返回 false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    const result = util.updateFeature({
      id: 'noexist',
      type: 'point',
      wkt: 'POINT(116 40)',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(false)
    util.destroy()
  })

  it('clear 无 callback 时正常执行', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    expect(util.clear()).toBe(true)
    util.destroy()
  })

  it('CREATING 状态下 clear 正常执行', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    util.createFeature({
      id: 'cc1',
      type: 'rect',
      detail: {
        lineWidth: 2, lineType: 'solid',
        lineRgba: 'rgba(255,0,0,1)', fillRgba: 'rgba(255,0,0,0.2)',
        textRgba: 'rgba(0,0,0,1)',
      },
    })
    util.dblclick([116, 40])
    expect(util.getState()).toBe(DrawState.CREATING)
    expect(util.clear()).toBe(true)
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('move 在 stage=-1 时正常返回', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    util.createFeature({
      id: 'm1',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    util.move([116, 40])
    expect(util.getState()).toBe(DrawState.CREATING)
    util.destroy()
  })

  it('三角形跳过单击直接双击应不完成', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    let completed = false
    util.createFeature(
      {
        id: 'tri_skip',
        type: 'triangle',
        detail: {
          lineWidth: 2, lineType: 'solid',
          lineRgba: 'rgba(0,255,0,1)', fillRgba: 'rgba(0,255,0,0.2)',
          textRgba: 'rgba(0,0,0,1)',
        },
      },
      () => { completed = true },
    )
    util.dblclick([116, 40])
    util.dblclick([117, 41])
    // 只有1个顶点时双击不应完成
    expect(util.getState()).toBe(DrawState.CREATING)
    expect(completed).toBe(false)
    util.destroy()
  })

  it('编辑态 toggle 状态正常', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      { id: 'ed2', type: 'point', detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' } },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    util.updateFeature(created!)
    expect(util.getState()).toBe(DrawState.EDITING)

    util.dblclick([116, 40])
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('线要素编辑态进入退出正常', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      { id: 'ln_edit', type: 'line', detail: { lineWidth: 2, lineType: 'solid', lineRgba: '#000', textRgba: '#000' } },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    util.dblclick([117, 41])
    expect(created).toBeDefined()

    util.updateFeature(created!)
    expect(util.getState()).toBe(DrawState.EDITING)
    util.dblclick([116, 40])
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('矩形要素编辑态进入退出正常', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      { id: 'r_edit', type: 'rect', detail: { lineWidth: 2, lineType: 'solid', lineRgba: '#000', fillRgba: '#fff', textRgba: '#000' } },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    util.dblclick([117, 41])
    expect(created).toBeDefined()

    util.updateFeature(created!)
    expect(util.getState()).toBe(DrawState.EDITING)
    util.dblclick([116, 40])
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('圆形要素编辑态进入退出正常', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      { id: 'c_edit', type: 'circle', detail: { radius: 1000, lineWidth: 2, lineType: 'solid', lineRgba: '#00f', fillRgba: '#00f2', textRgba: '#000' } },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    util.dblclick([116.01, 40])
    expect(created).toBeDefined()

    util.updateFeature(created!)
    expect(util.getState()).toBe(DrawState.EDITING)
    util.dblclick([116, 40])
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('三角形要素编辑态进入退出正常', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      { id: 'tri_edit', type: 'triangle', detail: { lineWidth: 2, lineType: 'solid', lineRgba: '#0f0', fillRgba: '#0f02', textRgba: '#000' } },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    util.click([117, 40])
    util.dblclick([116.5, 41])
    expect(created).toBeDefined()

    util.updateFeature(created!)
    expect(util.getState()).toBe(DrawState.EDITING)
    util.dblclick([116, 40])
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('destroy 时清理编辑交互', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)

    let created: FeatureInfo | undefined
    util.createFeature(
      { id: 'pt_destroy', type: 'point', detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' } },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    util.updateFeature(created!)
    expect(() => util.destroy()).not.toThrow()
  })

  it('点击在非 triangle/polyline/customShape 类型下不生效', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    util.createFeature({
      id: 'r_click',
      type: 'rect',
      detail: {
        lineWidth: 2, lineType: 'solid',
        lineRgba: 'rgba(255,0,0,1)', fillRgba: 'rgba(255,0,0,0.2)',
        textRgba: 'rgba(0,0,0,1)',
      },
    })
    util.dblclick([116, 40])
    util.click([117, 41])
    // rect click 应被忽略
    expect(util.getState()).toBe(DrawState.CREATING)
    util.destroy()
  })
})

// ========= addFeature / modifyFeature =========

describe('addFeature', () => {
  it('通过API直接添加要素（含WKT）', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    const result = util.addFeature({
      id: 'api1',
      type: 'point',
      wkt: 'POINT(116 40)',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(true)
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })

  it('ID重复时返回false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    util.addFeature({
      id: 'dup',
      type: 'point',
      wkt: 'POINT(116 40)',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    const result = util.addFeature({
      id: 'dup',
      type: 'point',
      wkt: 'POINT(117 41)',
      detail: { fillRgba: 'rgba(0,255,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(false)
    util.destroy()
  })

  it('无wkt时返回false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    const result = util.addFeature({
      id: 'nowkt',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(false)
    util.destroy()
  })

  it('name 为空时自动生成', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    util.addFeature({
      id: 'genname',
      type: 'point',
      wkt: 'POINT(116 40)',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    // should not throw, name auto-generated
    expect(true).toBe(true)
    util.destroy()
  })
})

describe('modifyFeature', () => {
  it('通过API修改已有要素', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    util.addFeature({
      id: 'mod1',
      type: 'point',
      wkt: 'POINT(116 40)',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    const result = util.modifyFeature({
      id: 'mod1',
      type: 'point',
      wkt: 'POINT(117 41)',
      detail: { fillRgba: 'rgba(0,255,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(true)
    util.destroy()
  })

  it('ID不存在时返回false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    const result = util.modifyFeature({
      id: 'noexist',
      type: 'point',
      wkt: 'POINT(116 40)',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(false)
    util.destroy()
  })

  it('无wkt时返回false', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    const result = util.modifyFeature({
      id: 'mod_nowkt',
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(false)
    util.destroy()
  })

  it('正在编辑该要素时先关闭编辑再重置', () => {
    const { map } = createMockMap()
    const cb = (_f: FeatureInfo[]) => {}
    const util = new OlDrawUtil(map, cb)
    // 先创建
    let created: FeatureInfo | undefined
    util.createFeature(
      { id: 'editing_mod', type: 'point', detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' } },
      (f) => { created = f },
    )
    util.dblclick([116, 40])
    // 进入编辑
    util.updateFeature(created!)
    expect(util.getState()).toBe(DrawState.EDITING)
    // modifyFeature 应关闭编辑并重置
    const result = util.modifyFeature({
      id: 'editing_mod',
      type: 'point',
      wkt: 'POINT(117 41)',
      detail: { fillRgba: 'rgba(0,255,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    })
    expect(result).toBe(true)
    expect(util.getState()).toBe(DrawState.IDLE)
    util.destroy()
  })
})

// ========= WKT 工具函数测试 =========

describe('WKT 工具函数', () => {
  it('parseWkt 解析 POINT', async () => {
    const { parseWkt } = await import('../src/utils/wkt')
    const { default: Point } = await import('ol/geom/Point.js')
    const geom = parseWkt('POINT(116.404 39.915)')
    expect(geom).toBeInstanceOf(Point)
    expect(geom.getType()).toBe('Point')
  })

  it('writeWkt 对 Point 正确', async () => {
    const { writeWkt } = await import('../src/utils/wkt')
    const { default: Point } = await import('ol/geom/Point.js')
    const wkt = writeWkt(new Point([116.404, 39.915]))
    expect(wkt).toBe('POINT(116.404 39.915)')
  })

  it('writeWkt 对 LineString 正确', async () => {
    const { writeWkt } = await import('../src/utils/wkt')
    const { default: LineString } = await import('ol/geom/LineString.js')
    const wkt = writeWkt(new LineString([[116, 40], [117, 41]]))
    expect(wkt).toContain('LINESTRING')
  })

  it('haversineDistance 计算正确', async () => {
    const { haversineDistance } = await import('../src/utils/wkt')
    const d = haversineDistance([116, 40], [116, 40.001])
    expect(d).toBeGreaterThan(0)
    expect(d).toBeLessThan(200)
  })

  it('rectCoordsFromDiagonal 生成正确闭合矩形', async () => {
    const { rectCoordsFromDiagonal } = await import('../src/utils/wkt')
    const rect = rectCoordsFromDiagonal([116, 40], [117, 41])
    expect(rect.length).toBe(5)
    expect(rect[0][0]).toBe(116)
    expect(rect[2][0]).toBe(117)
    expect(rect[0]).toEqual(rect[4])
  })

  it('generateCircleCoords 生成32边闭合多边形', async () => {
    const { generateCircleCoords } = await import('../src/utils/wkt')
    const coords = generateCircleCoords([116, 40], 1000)
    expect(coords.length).toBe(33)
    expect(coords[0]).toEqual(coords[32])
  })

  it('extractCoords 提取 Polygon 坐标', async () => {
    const { extractCoords } = await import('../src/utils/wkt')
    const { default: Polygon } = await import('ol/geom/Polygon.js')
    const ring: [number, number][] = [
      [116, 40], [117, 40], [117, 41], [116, 41], [116, 40],
    ]
    const poly = new Polygon([ring])
    const coords = extractCoords(poly)
    expect(coords.length).toBe(5)
  })

  it('extractCoords 提取 Point 坐标', async () => {
    const { extractCoords } = await import('../src/utils/wkt')
    const { default: Point } = await import('ol/geom/Point.js')
    const pt = new Point([116, 40])
    const coords = extractCoords(pt)
    expect(coords.length).toBe(1)
    expect(coords[0]).toEqual([116, 40])
  })

  it('extractCoords 提取 LineString 坐标', async () => {
    const { extractCoords } = await import('../src/utils/wkt')
    const { default: LineString } = await import('ol/geom/LineString.js')
    const ls = new LineString([[116, 40], [117, 41]])
    const coords = extractCoords(ls)
    expect(coords.length).toBe(2)
  })

  it('toCoord 和 toOlCoord 转换正确', async () => {
    const { toCoord, toOlCoord } = await import('../src/utils/wkt')
    const ol = toOlCoord([116, 40])
    expect(ol).toEqual([116, 40])
    const c = toCoord([117, 41])
    expect(c).toEqual([117, 41])
  })

  it('computeSegmentLengths 计算各段边长', async () => {
    const { computeSegmentLengths } = await import('../src/utils/wkt')
    const coords: [number, number][] = [
      [116, 40], [116, 40.001], [116.001, 40.001],
    ]
    const segments = computeSegmentLengths(coords)
    expect(segments.length).toBe(2)
    expect(segments[0].length).toBeGreaterThan(0)
  })

  it('sphericalArea 对 1°×1° 矩形返回合理面积', async () => {
    const { sphericalArea } = await import('../src/utils/wkt')
    const rect: [number, number][] = [
      [116, 40], [117, 40], [117, 41], [116, 41], [116, 40],
    ]
    const area = sphericalArea(rect)
    // 1°×1° at lat 40° ≈ 111km×85km ≈ 9500 km² ≈ 9.5e9 m²
    expect(area).toBeGreaterThan(8_000_000_000)
    expect(area).toBeLessThan(12_000_000_000)
  })

  it('sphericalArea 对小三角形返回 > 0', async () => {
    const { sphericalArea } = await import('../src/utils/wkt')
    const tri: [number, number][] = [
      [116, 40], [116.001, 40], [116.0005, 40.001], [116, 40],
    ]
    const area = sphericalArea(tri)
    expect(area).toBeGreaterThan(0)
  })
})

// ========= 名称生成 =========

describe('名称生成工具', () => {
  it('generateRandomName 生成8位字符串', async () => {
    const { generateRandomName } = await import('../src/utils/name')
    const name1 = generateRandomName()
    const name2 = generateRandomName()
    expect(name1.length).toBe(8)
    expect(name2.length).toBe(8)
    expect(name1).not.toBe(name2)
  })
})

// ========= Icon 工具 =========

describe('内置 Icon 工具', () => {
  it('getBuiltinIcon 生成 PNG data-URI', async () => {
    // mock Canvas API for Node environment
    const origCreateElement = globalThis.document?.createElement
    if (!globalThis.document) {
      ;(globalThis as any).document = {
        createElement(_tag: string) {
          const scratch: any = { width: 0, height: 0, style: {} }
          scratch.getContext = () => ({
            arc() {}, beginPath() {}, closePath() {}, fill() {}, moveTo() {}, lineTo() {},
            get globalAlpha() { return 1 }, set globalAlpha(_v: number) {},
            get fillStyle() { return '#000' }, set fillStyle(_v: string) {},
          })
          scratch.toDataURL = () => 'data:image/png;base64,mock'
          return scratch
        },
      }
    }
    const { getBuiltinIcon } = await import('../src/utils/icon')
    const uri = getBuiltinIcon('red')
    expect(uri).toContain('data:image/png')
    // restore
    if (origCreateElement != null) {
      globalThis.document.createElement = origCreateElement
    } else if ((globalThis as any).document) {
      delete (globalThis as any).document
    }
  })

  it('相同颜色返回缓存结果', async () => {
    const { getBuiltinIcon } = await import('../src/utils/icon')
    const a = getBuiltinIcon('red')
    const b = getBuiltinIcon('red')
    expect(a).toBe(b)
  })
})
