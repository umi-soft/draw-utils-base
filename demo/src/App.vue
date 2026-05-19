<template>
  <div id="demo-app" class="w-screen h-screen flex">
    <!-- sidebar -->
    <aside class="w-64 bg-gray-900 text-white flex flex-col p-3 gap-2 text-sm overflow-y-auto">
      <h2 class="text-base font-bold mb-1">绘图工具演示</h2>

      <div class="bg-gray-800 rounded p-2">
        <span class="text-gray-400">状态：</span>
        <span class="font-mono" :class="stateColor">{{ stateText }}</span>
      </div>

      <div class="flex flex-col gap-1">
        <h3 class="text-xs text-gray-400 font-semibold mt-1">新建绘制</h3>
        <button v-for="t in featureTypes" :key="t.value"
          class="px-3 py-1.5 rounded text-left hover:bg-blue-700 transition-colors"
          :class="creatingType === t.value ? 'bg-blue-600' : 'bg-gray-700'"
          @click="startCreate(t.value)">
          {{ t.label }}
        </button>
      </div>

      <div class="flex flex-col gap-1 mt-2">
        <h3 class="text-xs text-gray-400 font-semibold">操作</h3>
        <button class="px-3 py-1.5 rounded bg-gray-700 hover:bg-yellow-600 text-left"
          @click="toggleEdit">编辑选中要素</button>
        <button class="px-3 py-1.5 rounded bg-gray-700 hover:bg-red-700 text-left"
          @click="deleteSelected">删除选中要素</button>
        <button class="px-3 py-1.5 rounded bg-gray-700 hover:bg-red-800 text-left"
          @click="clearAll">清空全部</button>
      </div>

      <div class="flex flex-col gap-1 mt-2">
        <h3 class="text-xs text-gray-400 font-semibold">要素列表</h3>
        <div v-if="features.length === 0" class="text-gray-500 text-xs">暂无要素</div>
        <div v-for="f in features" :key="String(f.id)"
          class="px-2 py-1 rounded text-xs cursor-pointer truncate"
          :class="selectedId === f.id ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'"
          @click="selectedId = f.id">
          {{ f.type }}: {{ f.detail?.name || String(f.id) }}
        </div>
      </div>

      <div class="mt-auto pt-2 text-xs text-gray-500">
        <p>双击完成绘制 / 双击结束编辑</p>
        <p>编辑时拖拽顶点/靶点调整</p>
      </div>
    </aside>

    <!-- map -->
    <main class="flex-1 relative">
      <div ref="mapEl" class="absolute inset-0"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, shallowRef } from 'vue'
import OlMap from 'ol/Map.js'
import View from 'ol/View.js'
import { useGeographic } from 'ol/proj.js'
import TileLayer from 'ol/layer/Tile.js'
import XYZ from 'ol/source/XYZ.js'
import { OlDrawUtil } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'
import { DrawState } from '@loongbao-web-gis-utils/draw-utils-base-core'
import type { FeatureInfo, FeatureType, Coordinate } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'

const mapEl = ref<HTMLElement>()
const state = ref<DrawState>(DrawState.IDLE)
const features = ref<FeatureInfo[]>([])
const selectedId = ref<string | number | null>(null)
const creatingType = ref<FeatureType | null>(null)
let drawUtil: OlDrawUtil

let idCounter = 0

const featureTypes = [
  { label: '📍 点', value: 'point' as FeatureType },
  { label: '📏 线段', value: 'line' as FeatureType },
  { label: '🔲 矩形', value: 'rect' as FeatureType },
  { label: '🔺 三角形', value: 'triangle' as FeatureType },
  { label: '⭕ 圆形', value: 'circle' as FeatureType },
  { label: '📐 折线', value: 'polyline' as FeatureType },
  { label: '⬡ 自定义封闭图形', value: 'customShape' as FeatureType },
]

const stateText = computed(() => {
  switch (state.value) {
    case DrawState.IDLE: return '等待操作'
    case DrawState.CREATING: return '新增中...'
    case DrawState.EDITING: return '编辑中...'
  }
})
const stateColor = computed(() => {
  switch (state.value) {
    case DrawState.IDLE: return 'text-green-400'
    case DrawState.CREATING: return 'text-yellow-400'
    case DrawState.EDITING: return 'text-orange-400'
  }
})

function defaultDetail(type: FeatureType): any {
  const base = { textRgba: 'rgba(0,0,0,1)' }
  const area = { lineWidth: 2, lineType: 'solid', lineRgba: 'rgba(0,100,255,1)', fillRgba: 'rgba(0,100,255,0.2)' }
  switch (type) {
    case 'point': return { fillRgba: 'rgba(255,60,60,0.7)', ...base }
    case 'line': return { lineWidth: 2, lineType: 'solid', lineRgba: 'rgba(255,60,60,1)', ...base }
    case 'rect': return { ...area }
    case 'triangle': return { ...area, lineRgba: 'rgba(60,180,60,1)', fillRgba: 'rgba(60,180,60,0.2)' }
    case 'circle': return { radius: 500, ...area, lineRgba: 'rgba(255,180,0,1)', fillRgba: 'rgba(255,180,0,0.2)' }
    case 'polyline': return { lineWidth: 2, lineType: 'dashed', lineRgba: 'rgba(160,60,240,1)', ...base }
    case 'customShape': return { ...area, lineRgba: 'rgba(240,100,60,1)', fillRgba: 'rgba(240,100,60,0.2)' }
    default: return {}
  }
}

function onPickUp(hits: FeatureInfo[]) {
  for (const h of hits) {
    if (h.id != null) selectedId.value = h.id
  }
}

function onCreated(feature: FeatureInfo) {
  state.value = drawUtil.getState()
  creatingType.value = null
  const idx = features.value.findIndex((f) => f.id === feature.id)
  if (idx >= 0) features.value[idx] = feature
  else features.value.push({ ...feature })
}

function onEdited(feature: FeatureInfo) {
  state.value = drawUtil.getState()
  const idx = features.value.findIndex((f) => f.id === feature.id)
  if (idx >= 0) features.value[idx] = { ...feature }
}

function startCreate(type: FeatureType) {
  if (state.value !== DrawState.IDLE) return
  creatingType.value = type
  idCounter++
  drawUtil.createFeature(
    {
      id: `${type}-${idCounter}`,
      type,
      detail: defaultDetail(type),
    },
    onCreated,
  )
  state.value = drawUtil.getState()
}

function toggleEdit() {
  if (state.value !== DrawState.IDLE || !selectedId.value) return
  const f = features.value.find((x) => x.id === selectedId.value)
  if (!f || !f.wkt) return
  drawUtil.updateFeature({ ...f }, onEdited)
  state.value = drawUtil.getState()
}

function deleteSelected() {
  if (state.value !== DrawState.IDLE || !selectedId.value) return
  drawUtil.deleteFeature(selectedId.value)
  features.value = features.value.filter((x) => x.id !== selectedId.value)
  selectedId.value = null
}

function clearAll() {
  drawUtil.clear((cleared) => {
    features.value = features.value.filter((f) => !cleared!.find((c) => c.id === f.id))
  })
  selectedId.value = null
  state.value = DrawState.IDLE
}

onMounted(() => {
  if (!mapEl.value) return

  useGeographic()

  const map = new OlMap({
    target: mapEl.value,
    layers: [new TileLayer({
      source: new XYZ({
        url: 'https://wprd01.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7',
      }),
    })],
    view: new View({ center: [110.0, 19.0], zoom: 8 }),
  })

  drawUtil = new OlDrawUtil(map, onPickUp)

  map.on('click', (e: any) => {
    drawUtil.click([e.coordinate[0], e.coordinate[1]])
    state.value = drawUtil.getState()
    if (state.value === DrawState.IDLE) creatingType.value = null
  })

  map.on('dblclick', (e: any) => {
    drawUtil.dblclick([e.coordinate[0], e.coordinate[1]])
    state.value = drawUtil.getState()
    if (state.value === DrawState.IDLE) creatingType.value = null
  })

  let moveTimer: ReturnType<typeof setTimeout> | null = null
  map.on('pointermove', (e: any) => {
    if (moveTimer) return
    moveTimer = setTimeout(() => {
      moveTimer = null
      drawUtil.move([e.coordinate[0], e.coordinate[1]])
    }, 50)
  })
})
</script>
