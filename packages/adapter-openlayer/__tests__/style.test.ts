import { describe, it, expect } from 'vitest'
import {
  createFeatureStyle,
  createNameStyle,
  createIconStyle,
  createAreaTextStyle,
  createLengthTextStyle,
} from '../src/utils/style'
import type { FeatureInfo } from '@loongbao-web-gis-utils/draw-utils-base-core'
import { Style, Circle as CircleStyle, Icon, Text } from 'ol/style.js'

describe('style 工具函数', () => {
  describe('createFeatureStyle', () => {
    it('生成点要素默认圆点样式', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      }
      const s = createFeatureStyle(info)
      expect(s).toBeInstanceOf(Style)
      expect(s.getImage()).toBeInstanceOf(CircleStyle)
    })

    it('生成点要素高亮样式', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      }
      const s = createFeatureStyle(info, true)
      const img = s.getImage() as CircleStyle
      expect(img.getRadius()).toBeGreaterThan(8)
    })

    it('生成点要素 icon 模式样式', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: {
          name: 'test',
          iconSrc: 'https://example.com/a.png',
          fillRgba: 'rgba(255,0,0,0.5)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getImage()).toBeInstanceOf(Icon)
    })

    it('生成点要素 icon 模式高亮样式（scale 1.5）', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: {
          name: 'test',
          iconSrc: 'https://example.com/a.png',
          fillRgba: 'rgba(255,0,0,0.5)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info, true)
      const img = s.getImage() as Icon
      expect(img.getScale()).toBe(1.5)
    })

    it('无alpha的rgba字符串正常解析', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { fillRgba: 'rgb(255,0,0)', textRgba: 'rgba(0,0,0,1)' },
      }
      const s = createFeatureStyle(info)
      expect(s.getImage()).toBeInstanceOf(CircleStyle)
    })

    it('生成矩形要素样式（有填充+描边）', () => {
      const info: FeatureInfo = {
        id: '2',
        type: 'rect',
        detail: {
          lineWidth: 3,
          lineType: 'dashed',
          lineRgba: 'rgba(0,0,255,1)',
          fillRgba: 'rgba(0,0,255,0.3)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getFill()).toBeDefined()
      expect(s.getStroke()).toBeDefined()
    })

    it('生成矩形要素高亮样式（线宽放大1.5倍）', () => {
      const info: FeatureInfo = {
        id: '2',
        type: 'rect',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(0,0,255,1)',
          fillRgba: 'rgba(0,0,255,0.3)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info, true)
      expect(s.getStroke()!.getWidth()).toBe(3) // 2 * 1.5
    })

    it('生成三角形要素样式', () => {
      const info: FeatureInfo = {
        id: '3',
        type: 'triangle',
        detail: {
          lineWidth: 2,
          lineType: 'dashed',
          lineRgba: 'rgba(0,255,0,1)',
          fillRgba: 'rgba(0,255,0,0.2)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getFill()).toBeDefined()
      expect(s.getStroke()).toBeDefined()
    })

    it('生成圆形要素样式', () => {
      const info: FeatureInfo = {
        id: '4',
        type: 'circle',
        detail: {
          radius: 1000,
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(255,255,0,1)',
          fillRgba: 'rgba(255,255,0,0.2)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getFill()).toBeDefined()
      expect(s.getStroke()).toBeDefined()
    })

    it('生成线段要素样式', () => {
      const info: FeatureInfo = {
        id: '5',
        type: 'line',
        detail: {
          lineWidth: 2,
          lineType: 'dashed',
          lineRgba: 'rgba(128,0,128,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getFill()).toBeNull()
      expect(s.getStroke()).toBeDefined()
    })

    it('生成线段要素高亮样式（线宽放大1.5倍）', () => {
      const info: FeatureInfo = {
        id: '5',
        type: 'line',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(128,0,128,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info, true)
      expect(s.getStroke()!.getWidth()).toBe(3)
    })

    it('生成折线要素样式', () => {
      const info: FeatureInfo = {
        id: '6',
        type: 'polyline',
        detail: {
          lineWidth: 3,
          lineType: 'solid',
          lineRgba: 'rgba(255,0,0,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getFill()).toBeNull()
      expect(s.getStroke()).toBeDefined()
      expect(s.getStroke()!.getWidth()).toBe(3)
    })

    it('生成自定义封闭图形样式', () => {
      const info: FeatureInfo = {
        id: '7',
        type: 'customShape',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(128,0,128,1)',
          fillRgba: 'rgba(128,0,128,0.3)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getFill()).toBeDefined()
      expect(s.getStroke()).toBeDefined()
    })

    it('虚线类型使用 lineDash 样式', () => {
      const info: FeatureInfo = {
        id: '8',
        type: 'line',
        detail: {
          lineWidth: 2,
          lineType: 'dashed',
          lineRgba: 'rgba(0,0,0,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getStroke()!.getLineDash()).toEqual([8, 6])
    })

    it('实线类型无 lineDash', () => {
      const info: FeatureInfo = {
        id: '9',
        type: 'line',
        detail: {
          lineWidth: 2,
          lineType: 'solid',
          lineRgba: 'rgba(0,0,0,1)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createFeatureStyle(info)
      expect(s.getStroke()!.getLineDash()).toBeNull()
    })
  })

  describe('createNameStyle', () => {
    it('name 非空时生成 Text 样式', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { name: '测试点', fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      }
      const s = createNameStyle(info)
      expect(s.getText()).toBeInstanceOf(Text)
      expect(s.getText()!.getText()).toBe('测试点')
    })

    it('name 为空时返回空样式', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      }
      const s = createNameStyle(info)
      // name undefined → Style({}) 无 Text
      expect(s.getText()).toBeNull()
    })

    it('自定义 textRgba 效果', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { name: 'x', fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(255,0,0,1)' },
      }
      const s = createNameStyle(info)
      expect(s.getText()).toBeDefined()
    })

    it('textRgba 为空字符串时使用默认黑色', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { name: 'x', fillRgba: 'rgba(255,0,0,0.5)', textRgba: '' },
      }
      const s = createNameStyle(info)
      expect(s.getText()).toBeDefined()
      expect(s.getText()!.getFill()!.getColor()).toEqual([0, 0, 0, 1])
    })
  })

  describe('createIconStyle', () => {
    it('有 iconSrc 时生成 Icon 样式', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: {
          name: 'icon',
          iconSrc: 'https://example.com/a.png',
          fillRgba: 'rgba(255,0,0,0.5)',
          textRgba: 'rgba(0,0,0,1)',
        },
      }
      const s = createIconStyle(info)
      expect(s.getImage()).toBeInstanceOf(Icon)
    })

    it('无 iconSrc 时返回空样式', () => {
      const info: FeatureInfo = {
        id: '1',
        type: 'point',
        detail: { fillRgba: 'rgba(255,0,0,0.5)', textRgba: 'rgba(0,0,0,1)' },
      }
      const s = createIconStyle(info)
      expect(s.getImage()).toBeNull()
    })
  })

  describe('createAreaTextStyle', () => {
    it('< 1km² 时使用 m² 单位', () => {
      const s = createAreaTextStyle(500000) // 0.5 km² ... wait no, 500000 m²
      const text = s.getText()!.getText()!
      expect(text).toContain('m²')
    })

    it('≥ 1km² 时使用 km² 单位', () => {
      const s = createAreaTextStyle(2_000_000)
      const text = s.getText()!.getText()!
      expect(text).toContain('km²')
    })
  })

  describe('createLengthTextStyle', () => {
    it('< 1km 时使用 m 单位', () => {
      const s = createLengthTextStyle(500, [116, 40])
      const text = s.getText()!.getText()!
      expect(text).toContain('m')
    })

    it('≥ 1km 时使用 km 单位', () => {
      const s = createLengthTextStyle(2000, [116, 40])
      const text = s.getText()!.getText()!
      expect(text).toContain('km')
    })

    it('geometry 为指定坐标的 Point', () => {
      const s = createLengthTextStyle(100, [116.5, 40.5])
      expect(s.getGeometry()).toBeDefined()
    })
  })
})
