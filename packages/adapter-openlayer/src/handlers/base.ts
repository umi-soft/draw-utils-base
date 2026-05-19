import type { Coordinate, FeatureInfo, FeatureType } from '@loongbao-web-gis-utils/draw-utils-base-core'

export interface IFeatureHandler {
  readonly type: FeatureType

  /** 新建绘制 - 处理单击 */
  handleClick(coord: Coordinate): boolean

  /** 新建绘制 - 处理双击 */
  handleDblClick(coord: Coordinate): boolean

  /** 新建绘制 - 处理鼠标移动 */
  handleMove(coord: Coordinate): void

  /** 是否绘制完成 */
  isComplete(): boolean

  /** 获取完成的要素信息（含生成的 wkt） */
  getCompletedFeature(): FeatureInfo

  /** 重置状态 */
  reset(): void
}
