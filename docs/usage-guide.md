# usage-guide — 使用手册

## 概述

`@loongbao-web-gis-utils/draw-utils-base-openlayer` 是 Web GIS 通用绘图工具包的 Openlayer 适配版本。工具包内部独立管理图层的创建/销毁，通过统一的抽象接口对外暴露，业务集成方只需转发地图事件即可接入。

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
┌──────────▼──────────────┐
│       OlDrawUtil         │  ← packages/adapter-openlayer
│    Ol Modify/Translate   │
│    图层管理 样式渲染      │
└─────────────────────────┘
```

## 安装

```bash
pnpm add @loongbao-web-gis-utils/draw-utils-base-openlayer
```

依赖：`ol`（版本 10.9.0）需业务方自行安装。

## 快速开始

```typescript
import { OlDrawUtil } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'
import type { FeatureInfo, Coordinate } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'
import OlMap from 'ol/Map.js'
import View from 'ol/View.js'
import TileLayer from 'ol/layer/Tile.js'
import OSM from 'ol/source/OSM.js'

// 1. 创建地图
const map = new OlMap({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  view: new View({ center: [116.4, 39.9], zoom: 10 }),
})

// 2. 创建绘图工具实例
const drawUtil = new OlDrawUtil(map, (features: FeatureInfo[]) => {
  console.log('命中要素:', features)
})

// 3. 转发地图事件
map.on('click', (e) => drawUtil.click([e.coordinate[0], e.coordinate[1]]))
map.on('dblclick', (e) => drawUtil.dblclick([e.coordinate[0], e.coordinate[1]]))
map.on('pointermove', (e) => drawUtil.move([e.coordinate[0], e.coordinate[1]]))
```

## API 参考

### `constructor(map, pickUpCallback)`

- `map` — OL Map 实例
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
- `callback` — 编辑完成时回调
- 返回 `false` — 不处于等待状态 / wkt 为空 / 要素不存在

**交互**：双击任意位置结束编辑。

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
    iconSrc: '可选',                    // 空则圆点模式，非空则icon模式
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
    lineType: 'solid' | 'dashed',       // 虚线固定8-6间隔
    lineRgba: 'rgba(255,0,0,1)',
    fillRgba: 'rgba(255,0,0,0.2)',
    textRgba: 'rgba(0,0,0,1)',
  }
}
```

交互：双击对角线两点完成。编辑时拖拽顶点自动保持矩形形状。

### 三角形 (type: "triangle")

同 RectInfo。交互：双击→单击→双击完成三个顶点。

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

WKT 存圆心 Point。32边形渲染。编辑时拖拽圆周靶点调半径。半径标签显示在圆心左侧。

### 线段 (type: "line")

同 RectInfo（无 fillRgba）。交互：两次双击。编辑：两端点+中点靶点。

### 折线 (type: "polyline")

约束 ≥ 3 个点。双击取第一点，单击追加中间点，双击结束。编辑：悬浮线段任意位置显示插入靶点，单击插入新顶点。

### 自定义封闭图形 (type: "customShape")

类似折线，但首尾自动闭合，为 Polygon。

## 面积和边长

- 封闭图形自动显示面积标签（m²/km²，2位小数，中心偏右）
- 非点要素自动显示边长标签（m/km，2位小数，各边中点）
- 圆形例外：显示半径标签（圆心偏左）

## 已知限制

- 矩形/三角形的"边平移拖拽"（拖拽边使两边端点同步移动）暂不支持，可通过拖拽顶点替代
- 编辑过程中面积/边长标注在编辑完成后刷新，拖拽过程中不实时更新
