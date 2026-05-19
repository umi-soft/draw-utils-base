import { describe, it, expect } from 'vitest'
import { DrawState } from '../src/types/draw-state'
import type { Coordinate } from '../src/types/coordinate'
import type { PointInfo } from '../src/types/detail'
import type { FeatureInfo } from '../src/types/feature'
import { IWebGisDrawBasicUtil } from '../src/abstract/draw-basic-util'

describe('DrawState', () => {
  it('应包含三个状态值', () => {
    expect(DrawState.IDLE).toBe('idle')
    expect(DrawState.CREATING).toBe('creating')
    expect(DrawState.EDITING).toBe('editing')
  })
})

describe('Coordinate 类型', () => {
  it('应支持 [lng, lat] 格式', () => {
    const coord: Coordinate = [116.404, 39.915]
    expect(coord[0]).toBe(116.404)
    expect(coord[1]).toBe(39.915)
  })
})

describe('PointInfo 类型', () => {
  it('应支持可选 name 和 iconSrc', () => {
    const info: PointInfo = {
      fillRgba: 'rgba(255,0,0,0.5)',
      textRgba: 'rgba(0,0,0,1)',
    }
    expect(info.fillRgba).toBe('rgba(255,0,0,0.5)')
    expect(info.iconSrc).toBeUndefined()
    expect(info.name).toBeUndefined()
  })
})

describe('FeatureInfo 判别联合类型', () => {
  it('应根据 type 推断正确的 detail 类型', () => {
    const point: FeatureInfo = {
      id: 1,
      type: 'point',
      detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
    }
    const rect: FeatureInfo = {
      id: 2,
      type: 'rect',
      detail: {
        lineWidth: 2,
        lineType: 'solid',
        lineRgba: '#000',
        fillRgba: '#fff',
        textRgba: '#000',
      },
    }
    expect(point.type).toBe('point')
    expect(rect.type).toBe('rect')
  })

  it('wkt 应为可选字段', () => {
    const line: FeatureInfo = {
      id: 3,
      type: 'line',
      wkt: 'LINESTRING(116.404 39.915, 116.405 39.916)',
      detail: {
        lineWidth: 2,
        lineType: 'solid',
        lineRgba: '#000',
        textRgba: '#000',
      },
    }
    expect(line.wkt).toBeDefined()
  })
})

describe('IWebGisDrawBasicUtil 抽象类', () => {
  it('应可被继承', () => {
    const pickUpCb = (_features: FeatureInfo[]) => {}
    class ConcreteUtil extends IWebGisDrawBasicUtil {
      click(): void {}
      dblclick(): void {}
      move(): void {}
      createFeature(): boolean {
        return true
      }
      updateFeature(): boolean {
        return true
      }
      deleteFeature(): boolean {
        return true
      }
      clear(): boolean {
        return true
      }
      getState() {
        return DrawState.IDLE
      }
      destroy(): void {}
    }
    const instance = new ConcreteUtil({}, pickUpCb)
    expect(instance).toBeInstanceOf(IWebGisDrawBasicUtil)
    expect(instance.getState()).toBe(DrawState.IDLE)
  })
})
