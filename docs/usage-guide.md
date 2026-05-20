# usage-guide — 使用手册

## 概述

Web GIS 通用绘图工具包，通过统一的抽象接口对外暴露。内部独立管理图层创建/销毁，业务方只需转发地图事件即可接入。

### 架构

```
业务集成方
    │ 事件转发 (click/dblclick/move)
    ▼
┌─────────────────────────┐
│   IWebGisDrawBasicUtil  │  ← packages/core (GIS无关抽象)
│   状态机: IDLE/CREATING/EDITING │
└──────────┬──────────────┘
           │ 继承
┌──────────▼──────────────────────┐
│ OlDrawUtil  /  MlDrawUtil       │  ← adapter-openlayer / adapter-maplibre
│ 图层管理 样式渲染 编辑交互       │
└─────────────────────────────────┘
```

### 包列表

| 包名 | 说明 |
|------|------|
| `@loongbao-web-gis-utils/draw-utils-base-core` | 核心抽象（类型+接口） |
| `@loongbao-web-gis-utils/draw-utils-base-openlayer` | OpenLayer 适配 |
| `@loongbao-web-gis-utils/draw-utils-base-maplibre` | MapLibre GL JS 适配 |

## 安装

```bash
# OpenLayer 版
pnpm add @loongbao-web-gis-utils/draw-utils-base-openlayer ol@10.9.0

# MapLibre 版
pnpm add @loongbao-web-gis-utils/draw-utils-base-maplibre maplibre-gl@5.24.0
```

## 快速开始

### OpenLayer

```typescript
import { OlDrawUtil } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'
import type { FeatureInfo } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'

const drawUtil = new OlDrawUtil(map, (features: FeatureInfo[]) => {
  console.log('命中要素:', features)
})

map.on('click', (e) => drawUtil.click([e.coordinate[0], e.coordinate[1]]))
map.on('dblclick', (e) => drawUtil.dblclick([e.coordinate[0], e.coordinate[1]]))
map.on('pointermove', (e) => drawUtil.move([e.coordinate[0], e.coordinate[1]]))
```

### MapLibre GL JS

```typescript
import { MlDrawUtil } from '@loongbao-web-gis-utils/draw-utils-base-maplibre'
import type { FeatureInfo } from '@loongbao-web-gis-utils/draw-utils-base-maplibre'

const drawUtil = new MlDrawUtil(map, (features: FeatureInfo[]) => {
  console.log('命中要素:', features)
})

map.on('click', (e) => drawUtil.click([e.lngLat.lng, e.lngLat.lat]))
map.on('dblclick', (e) => drawUtil.dblclick([e.lngLat.lng, e.lngLat.lat]))
map.on('mousemove', (e) => drawUtil.move([e.lngLat.lng, e.lngLat.lat]))
```

## API 参考

### `constructor(map, pickUpCallback)`

- `map` — 地图实例
- `pickUpCallback` — 等待状态下，单击/双击命中要素时回调，参数为命中的 `FeatureInfo[]`

### `createFeature(info, callback?): boolean`

发起新建绘制。

- `info` — FeatureInfo（wkt 可空，name 空时自动生成 8 位英文名）
- `callback` — 绘制完成时回调，参数为含 wkt 的完整 FeatureInfo
- 返回 `false` — 当前不处于等待状态

**交互**：第一次双击进入新增状态并确定第一点；第二次双击结束绘制。点类型仅需一次双击。

### `updateFeature(info, callback?): boolean`

发起编辑绘制。进入编辑后显示原始副本（灰色虚线 ghost），可拖拽修改。

- `info` — 必须包含 wkt
- `callback` — 编辑完成时回调（双击任意位置）
- 返回 `false` — 不处于等待状态 / wkt 为空 / 要素不存在

### `addFeature(info): boolean`

通过 API 直接添加要素（含 WKT）。id 重复返回 false。

### `modifyFeature(info): boolean`

按 id 重置要素。若当前正在编辑，先关闭编辑回到等待状态。id 不存在或无 wkt 返回 false。

### `deleteFeature(id, callback?): boolean`

删除指定要素。

### `clear(callback?): boolean`

清空全部要素。

### `getState(): DrawState`

返回当前状态：`DrawState.IDLE | DrawState.CREATING | DrawState.EDITING`

### `destroy()`

销毁图层、要素、交互，释放资源。

## 要素类型

### 点 (type: "point")

```typescript
{
  id: 'p1', type: 'point',
  detail: {
    name: '可选',                       // 空时自动生成
    iconSrc: '可选',                    // 空→圆点，非空→icon（内置 red/blue/green/orange/purple 或 URL）
    fillRgba: 'rgba(255,0,0,0.5)',
    textRgba: 'rgba(0,0,0,1)',
  }
}
```

### 矩形 (type: "rect")

```typescript
{
  id: 'r1', type: 'rect',
  detail: {
    lineWidth: 2,
    lineType: 'solid' | 'dashed',
    lineRgba: 'rgba(255,0,0,1)',
    fillRgba: 'rgba(255,0,0,0.2)',
    textRgba: 'rgba(0,0,0,1)',
  }
}
```

交互：双击对角线两点完成。编辑时拖拽顶点自动保持矩形形状。

### 三角形 (type: "triangle")

同 RectInfo 结构。交互：双击→单击→双击完成三个顶点。

### 圆形 (type: "circle")

```typescript
{
  id: 'c1', type: 'circle',
  detail: {
    radius: 1000,                       // 初始半径(米)
    lineWidth: 2, lineType: 'solid',
    lineRgba: 'rgba(0,0,255,1)',
    fillRgba: 'rgba(0,0,255,0.2)',
    textRgba: 'rgba(0,0,0,1)',
  }
}
```

WKT 存圆心 Point。32边形渲染。编辑时拖拽圆周靶点调半径。

### 线段 (type: "line")

同 RectInfo（无 fillRgba）。交互：两次双击。编辑：两端点+中点靶点。

### 折线 (type: "polyline")

约束 ≥ 3 个点。双击取第一点，单击追加中间点，双击结束。
编辑：顶点靶点拖拽；OL 版支持悬浮插入靶点。

### 自定义封闭图形 (type: "customShape")

类似折线但首尾自动闭合为 Polygon。约束 ≥ 3 个点。

## 面积和边长

- 封闭图形自动显示面积标签（m²/km²，2位小数，中心偏右）
- 非点要素自动显示边长标签（m/km，2位小数，各边中点）
- 圆例外：显示半径标签（圆弧上）

## 已知限制

- OL 版：矩形/三角形边平移拖拽依赖 Modify 交互
- ML 版：编辑态拖拽依靠自定义 Canvas 事件，体验略逊于 OL 版
- ML 版：编辑中面积/边长实时刷新待完善
