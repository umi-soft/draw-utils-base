/** 点要素详情 */
export interface PointInfo {
  /** 名称，允许为空，为空时当前类型图形无需渲染 name */
  name?: string
  /** icon地址，为空时采用圆点模式渲染（默认） */
  iconSrc?: string
  /** 填充颜色，RGBA格式 */
  fillRgba: string
  /** 文本颜色，RGBA格式，对name有效 */
  textRgba: string
}

/** 矩形要素详情 */
export interface RectInfo {
  /** 名称 */
  name?: string
  /** icon地址 */
  iconSrc?: string
  /** 线条宽度 */
  lineWidth: number
  /** 线条类型：虚线 dashed、实线 solid */
  lineType: 'dashed' | 'solid'
  /** 线条颜色，RGBA格式 */
  lineRgba: string
  /** 填充颜色，RGBA格式 */
  fillRgba: string
  /** 文本颜色，RGBA格式 */
  textRgba: string
}

/** 三角形要素详情 */
export interface TriangleInfo {
  /** 名称 */
  name?: string
  /** icon地址 */
  iconSrc?: string
  /** 线条宽度，默认值为2 */
  lineWidth: number
  /** 线条类型：虚线 dashed、实线 solid */
  lineType: 'dashed' | 'solid'
  /** 线条颜色，RGBA格式 */
  lineRgba: string
  /** 填充颜色，RGBA格式 */
  fillRgba: string
  /** 文本颜色，RGBA格式 */
  textRgba: string
}

/** 圆形要素详情（WKT采取Point存储圆心坐标） */
export interface CircleInfo {
  /** 名称 */
  name?: string
  /** icon地址 */
  iconSrc?: string
  /** 半径（米） */
  radius: number
  /** 线条宽度 */
  lineWidth: number
  /** 线条类型：虚线 dashed、实线 solid */
  lineType: 'dashed' | 'solid'
  /** 线条颜色，RGBA格式 */
  lineRgba: string
  /** 填充颜色，RGBA格式 */
  fillRgba: string
  /** 文本颜色，RGBA格式 */
  textRgba: string
}

/** 线段要素详情 */
export interface LineInfo {
  /** 名称 */
  name?: string
  /** icon地址 */
  iconSrc?: string
  /** 线条宽度 */
  lineWidth: number
  /** 线条类型：虚线 dashed、实线 solid */
  lineType: 'dashed' | 'solid'
  /** 线条颜色，RGBA格式 */
  lineRgba: string
  /** 文本颜色，RGBA格式 */
  textRgba: string
}

/** 折线要素详情 */
export interface PolylineInfo {
  /** 名称 */
  name?: string
  /** icon地址 */
  iconSrc?: string
  /** 线条宽度 */
  lineWidth: number
  /** 线条类型：虚线 dashed、实线 solid */
  lineType: 'dashed' | 'solid'
  /** 线条颜色，RGBA格式 */
  lineRgba: string
  /** 文本颜色，RGBA格式 */
  textRgba: string
}

/** 自定义封闭图形要素详情 */
export interface ShapeInfo {
  /** 名称 */
  name?: string
  /** icon地址 */
  iconSrc?: string
  /** 线条宽度 */
  lineWidth: number
  /** 线条类型：虚线 dashed、实线 solid */
  lineType: 'dashed' | 'solid'
  /** 线条颜色，RGBA格式 */
  lineRgba: string
  /** 填充颜色，RGBA格式 */
  fillRgba: string
  /** 文本颜色，RGBA格式 */
  textRgba: string
}

/** 要素详情联合类型 */
export type FeatureDetail = PointInfo | RectInfo | TriangleInfo | CircleInfo | LineInfo | PolylineInfo | ShapeInfo
