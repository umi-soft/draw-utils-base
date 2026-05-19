import type { Coordinate } from '../types/coordinate'
import type { FeatureInfo } from '../types/feature'
import { DrawState } from '../types/draw-state'

/**
 * Web GIS 基础绘图工具抽象类
 * 所有GIS框架适配层必须继承并实现此类
 */
export abstract class IWebGisDrawBasicUtil {
  protected map: unknown
  protected pickUpCallback: (features: FeatureInfo[]) => void

  /**
   * @param map 地图实例由业务集成方实例化时传递
   * @param pickUpCallback 工具内部对于鼠标的单击、双击事件，若当前处于等待操作状态，
   *   且本次单击或双击命中了某个元素或多个元素，则回调该方法
   */
  constructor(map: unknown, pickUpCallback: (features: FeatureInfo[]) => void) {
    this.map = map
    this.pickUpCallback = pickUpCallback
  }

  /**
   * 单击事件，由外部业务集成方统一监听后，回调该方法
   * @param coord 经纬度坐标
   */
  abstract click(coord: Coordinate): void

  /**
   * 双击事件，由外部业务集成方统一监听后，回调该方法
   * @param coord 经纬度坐标
   */
  abstract dblclick(coord: Coordinate): void

  /**
   * 鼠标移动事件，由外部业务集成方统一监听后，回调该方法
   * @param coord 经纬度坐标
   */
  abstract move(coord: Coordinate): void

  /**
   * 通过API直接添加一个要素，要检测id是否重复，若重复，直接返回false
   * @param info 要素信息（必须包含wkt）
   */
  abstract addFeature(info: FeatureInfo): boolean

  /**
   * 依据id强行重置某个元素
   * 需检测ID是否存在，若不存在，直接返回false
   * 若当前该元素正在被编辑，先关闭编辑进入等待状态，然后整体重置
   * @param info 要素信息（必须包含wkt和id）
   */
  abstract modifyFeature(info: FeatureInfo): boolean

  /**
   * 发起新建绘制
   * 1. 检测当前必须处于等待状态，若不处于等待状态，直接返回false
   * 2. 执行初始化工作
   * 3. 进入新增状态，返回true
   * @param info 要素信息（wkt初始为空，name为空时自动生成）
   * @param callback 完成新增绘制时业务回调
   */
  abstract createFeature(info: FeatureInfo, callback?: (feature: FeatureInfo) => void): boolean

  /**
   * 发起编辑绘制
   * 1. 检测当前必须处于等待状态，若不处于等待状态，直接返回false
   * 2. 复制要素信息用于前后对比，构建拖拽靶点
   * 3. 进入编辑状态，返回true
   * @param info 要素信息（必须包含wkt）
   * @param callback 完成编辑绘制时业务回调
   */
  abstract updateFeature(info: FeatureInfo, callback?: (feature: FeatureInfo) => void): boolean

  /**
   * 删除指定要素
   * 1. 检测当前必须处于等待状态，若不处于等待状态，直接返回false
   * 2. 执行删除逻辑，恢复等待操作状态
   * @param id 需要被删除要素的ID
   * @param callback 删除成功后的业务回调
   */
  abstract deleteFeature(id: string | number, callback?: (feature: FeatureInfo) => void): boolean

  /**
   * 强制清空所有要素
   * 直接进入等待操作状态，清空所有要素后返回true
   * @param callback 清空成功后的业务回调
   */
  abstract clear(callback?: (features: FeatureInfo[]) => void): boolean

  /** 获取当前工具状态 */
  abstract getState(): DrawState

  /** 销毁一切（图层、要素、交互信息） */
  abstract destroy(): void
}
