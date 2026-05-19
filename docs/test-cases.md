# 测试用例文档

## 测试文件

| 文件 | 测试范围 |
|------|----------|
| `packages/core/__tests__/types.test.ts` | 核心类型定义、DrawState枚举、FeatureInfo判别联合、抽象类可继承性 |
| `packages/adapter-openlayer/__tests__/ol-draw-util.test.ts` | OlDrawUtil 生命周期、状态机、7种图形CRUD、WKT工具、名称生成 |
| `packages/adapter-openlayer/__tests__/style.test.ts` | 样式创建（7种图形、高亮、icon、名称、面积/边长标签） |

## 核心类型测试 (6项)

| 用例 | 覆盖 |
|------|------|
| DrawState 应包含三个状态值 | 枚举值正确性 |
| Coordinate 应支持 [lng, lat] 格式 | 坐标类型 |
| PointInfo 应支持可选 name 和 iconSrc | Point 字段 |
| FeatureInfo 应根据 type 推断正确的 detail 类型 | 判别联合类型 |
| wkt 应为可选字段 | 可选 wkt |
| IWebGisDrawBasicUtil 应可被继承 | 抽象类可实例化 |

## OlDrawUtil 生命周期测试 (9项)

| 用例 | 覆盖 |
|------|------|
| 构造后初始状态为 IDLE | 初始状态 |
| destroy 后不会抛出异常 | 销毁 |
| IDLE 状态下 createFeature 返回 true 并切换到 CREATING | 状态转换 |
| CREATING 状态下 createFeature 返回 false | 状态保护 |
| CREATING 状态下 deleteFeature 返回 false | 状态保护 |
| 点类型绘制完成后恢复到 IDLE | 完成→归位 |
| click/dblclick/move 在 IDLE 状态下不抛出异常 | 事件安全 |
| move 在 stage=-1 时正常返回 | 未开始阶段 move |
| 三角形跳过单击直接双击应不完成 | 三角形状态保护 |

## 点要素测试 (3项)

| 用例 | 覆盖 |
|------|------|
| 一次双击完成绘制并生成 WKT (POINT) | 新建完成 |
| name 为空时自动生成 | 名称生成 |
| icon 模式 point 绘制成功 | icon 样式 |

## 矩形要素测试 (1项)

| 用例 | 覆盖 |
|------|------|
| 两次双击完成矩形绘制 (POLYGON) | 新建完成 |

## 三角形要素测试 (1项)

| 用例 | 覆盖 |
|------|------|
| 双击→单击→双击完成三角形绘制 | 三阶段新建 |

## 圆形要素测试 (1项)

| 用例 | 覆盖 |
|------|------|
| 两次双击完成圆形绘制，WKT 存圆心 Point | 新建完成+WKT正确 |
| radius 大于 0 | 半径计算 |

## 线段要素测试 (1项)

| 用例 | 覆盖 |
|------|------|
| 两次双击完成线段绘制 | 新建完成 |

## 折线要素测试 (2项)

| 用例 | 覆盖 |
|------|------|
| 双击→单击→单击→双击完成折线绘制（≥3点） | 新建完成 |
| 只有1个中间点时双击无效（<3个点约束） | 约束检查 |

## 自定义封闭图形测试 (1项)

| 用例 | 覆盖 |
|------|------|
| 双击→单击→单击→双击完成封闭图形绘制 | 新建完成 |

## CRUD 操作测试 (14项)

| 用例 | 覆盖 |
|------|------|
| deleteFeature 删除已存在要素并回调 | 删除+回调 |
| deleteFeature 删除不存在的要素返回 false | 不存在处理 |
| clear 清空所有要素并回调 | 清空+回调 |
| updateFeature 在 IDLE 状态下进入 EDITING | 编辑进入 |
| updateFeature 无 wkt 时返回 false | wkt 校验 |
| updateFeature 要素不存在时返回 false | 不存在处理 |
| clear 无 callback 时正常执行 | 可选回调 |
| CREATING 状态下 clear 正常执行 | 跨状态清空 |
| 编辑态 toggle 状态正常 | 编辑完整流程 |
| 线要素编辑态进入退出正常 | 线编辑 |
| 矩形要素编辑态进入退出正常 | 矩形编辑 |
| 圆形要素编辑态进入退出正常 | 圆形编辑 |
| 三角形要素编辑态进入退出正常 | 三角形编辑 |
| destroy 时清理编辑交互 | 销毁清理 |
| 点击在非 triangle/polyline/customShape 类型下不生效 | 类型过滤 |

## WKT 工具函数测试 (9项)

| 用例 | 覆盖 |
|------|------|
| parseWkt 解析 POINT | 解析 |
| writeWkt 对 Point 正确 | Point→WKT |
| writeWkt 对 LineString 正确 | LineString→WKT |
| haversineDistance 计算正确 | 距离计算 |
| rectCoordsFromDiagonal 生成正确闭合矩形 | 矩形坐标 |
| generateCircleCoords 生成32边闭合多边形 | 圆坐标生成 |
| extractCoords 提取 Polygon/Point/LineString 坐标 | 坐标提取 |
| toCoord 和 toOlCoord 转换正确 | 坐标转换 |
| computeSegmentLengths 计算各段边长 | 边长分段 |

## 名称生成测试 (1项)

| 用例 | 覆盖 |
|------|------|
| generateRandomName 生成8位字符串且唯一 | 唯一性+长度 |

## 样式函数测试 (19项)

| 用例 | 覆盖 |
|------|------|
| 生成点要素默认圆点样式 | 圆点模式 |
| 生成点要素高亮样式 | 高亮半径 |
| 生成点要素 icon 模式样式 | icon 样式 |
| 生成点要素 icon 模式高亮样式（scale 1.5） | icon 高亮 |
| 无alpha的rgba字符串正常解析 | parseRgba 边界 |
| 生成矩形要素样式（有填充+描边） | 矩形样式 |
| 生成矩形要素高亮样式（线宽放大1.5倍） | 矩形高亮 |
| 生成三角形要素样式 | 三角形样式 |
| 生成圆形要素样式 | 圆形样式 |
| 生成线段要素样式 | 线段样式 |
| 生成线段要素高亮样式（线宽放大1.5倍） | 线段高亮 |
| 生成折线要素样式 | 折线样式 |
| 生成自定义封闭图形样式 | 自定义样式 |
| 虚线类型使用 lineDash 样式 | 虚线配置 |
| 实线类型无 lineDash | 实线配置 |
| name 非空时生成 Text 样式 | 名称文本 |
| name 为空时返回空样式 | 空名称处理 |
| 自定义 textRgba 效果 | 文本颜色 |
| textRgba 为空字符串时使用默认黑色 | 文本回退 |
| 有 iconSrc 时生成 Icon 样式 | icon 生成 |
| 无 iconSrc 时返回空样式 | 空 icon 处理 |
| < 1km² 时使用 m² 单位 | 面积单位 |
| ≥ 1km² 时使用 km² 单位 | 面积单位 |
| < 1km 时使用 m 单位 | 长度单位 |
| ≥ 1km 时使用 km 单位 | 长度单位 |
| geometry 为指定坐标的 Point | 长度标签位置 |

## 合计

- **测试文件**: 3 个
- **测试用例**: 78 项
- **覆盖范围**: 核心类型、状态机、7种图形新建、CRUD全部操作、WKT工具、样式渲染、名称生成
- **已知未覆盖**: OL Modify/Translate 事件回调（modifystart/modifyend/translating）— 需真实地图交互
