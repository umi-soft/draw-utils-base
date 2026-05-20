<template>
  <div id="demo-app" class="w-screen h-screen flex">
    <!-- sidebar -->
    <aside class="w-72 bg-gray-900 text-white flex flex-col p-3 gap-1.5 text-sm overflow-y-auto shrink-0">
      <h2 class="text-base font-bold mb-1">绘图工具演示</h2>

      <div class="bg-gray-800 rounded p-2 flex items-center gap-2">
        <span class="text-gray-400 text-xs">框架：</span>
        <select v-model="framework" class="bg-gray-700 rounded px-2 py-1 text-xs text-white flex-1">
          <option value="ol">OpenLayer (10.9)</option>
          <option value="ml">MapLibre (5.24)</option>
        </select>
      </div>

      <div class="bg-gray-800 rounded p-2">
        <span class="text-gray-400">状态：</span>
        <span class="font-mono" :class="stateColor">{{ stateText }}</span>
      </div>

      <!-- 新建 -->
      <h3 class="text-xs text-gray-400 font-semibold mt-1">新建绘制</h3>
      <button v-for="t in featureTypes" :key="t.value"
        class="px-3 py-1.5 rounded text-left hover:bg-blue-700"
        :class="creatingType === t.value ? 'bg-blue-600' : 'bg-gray-700'"
        @click="startCreate(t.value)">{{ t.label }}</button>

      <!-- 操作 -->
      <h3 class="text-xs text-gray-400 font-semibold mt-1">操作</h3>
      <button class="px-3 py-1.5 rounded bg-gray-700 hover:bg-yellow-600 text-left" @click="toggleEdit">编辑选中</button>
      <button class="px-3 py-1.5 rounded bg-gray-700 hover:bg-red-700 text-left" @click="deleteSelected">删除选中</button>
      <button class="px-3 py-1.5 rounded bg-gray-700 hover:bg-red-800 text-left" @click="clearAll">清空全部</button>

      <!-- 要素列表 -->
      <h3 class="text-xs text-gray-400 font-semibold mt-1">要素列表</h3>
      <div v-if="features.length === 0" class="text-gray-500 text-xs">暂无要素</div>
      <div v-for="f in features" :key="String(f.id)"
        class="px-2 py-1 rounded text-xs cursor-pointer truncate"
        :class="selectedId === f.id ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'"
        @click="selectFeature(f)">
        {{ f.type }}: {{ f.detail?.name || String(f.id) }}</div>

      <!-- 属性编辑 -->
      <template v-if="editingFeature">
        <h3 class="text-xs text-gray-400 font-semibold mt-2">属性编辑</h3>
        <div class="bg-gray-800 rounded p-2 flex flex-col gap-1.5">

          <div>
            <label class="text-gray-500 text-xs">icon (URL/颜色名)</label>
            <input v-model="editDetail.iconSrc" class="w-full bg-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="留空=无icon" />
            <div class="flex gap-1 mt-1 flex-wrap">
              <div v-for="ic in iconPresets" :key="ic" class="w-5 h-5 rounded cursor-pointer border border-gray-600 hover:border-white"
                :style="{ background: ic === 'none' ? '#555' : ic }"
                :title="ic"
                @click="editDetail.iconSrc = ic === 'none' ? '' : ic"></div>
            </div>
          </div>

          <div>
            <label class="text-gray-500 text-xs">name</label>
            <input v-model="editDetail.name" class="w-full bg-gray-700 rounded px-2 py-1 text-xs text-white" />
          </div>

          <div v-if="hasLineStyle">
            <label class="text-gray-500 text-xs">lineWidth</label>
            <input v-model.number="editDetail.lineWidth" type="range" min="1" max="10" class="w-full" />
            <span class="text-gray-500 text-xs">{{ editDetail.lineWidth }}</span>
          </div>

          <div v-if="hasLineStyle">
            <label class="text-gray-500 text-xs">lineType</label>
            <select v-model="editDetail.lineType" class="w-full bg-gray-700 rounded px-2 py-1 text-xs text-white">
              <option value="solid">solid</option>
              <option value="dashed">dashed</option>
            </select>
          </div>

          <div v-if="hasLineStyle">
            <label class="text-gray-500 text-xs">lineRgba</label>
            <div class="flex gap-1">
              <input v-model="editDetail.lineRgba" class="flex-1 bg-gray-700 rounded px-2 py-1 text-xs text-white" />
              <input v-model="lineHex" type="color" class="w-8 h-6 rounded cursor-pointer" />
            </div>
          </div>

          <div v-if="isPointType || hasFillRgba">
            <label class="text-gray-500 text-xs">{{ isPointType ? 'fillRgba' : 'fillRgba' }}</label>
            <div class="flex gap-1">
              <input v-model="fillRgbaModel" class="flex-1 bg-gray-700 rounded px-2 py-1 text-xs text-white" />
              <input v-model="fillHex" type="color" class="w-8 h-6 rounded cursor-pointer" />
            </div>
          </div>

          <div>
            <label class="text-gray-500 text-xs">textRgba</label>
            <div class="flex gap-1">
              <input v-model="editDetail.textRgba" class="flex-1 bg-gray-700 rounded px-2 py-1 text-xs text-white" />
              <input v-model="textHex" type="color" class="w-8 h-6 rounded cursor-pointer" />
            </div>
          </div>

          <button class="px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-center mt-1"
            @click="applyProperties">应用属性</button>
        </div>
      </template>

      <div class="mt-auto pt-2 text-xs text-gray-500">
        <p>双击完成绘制 / 结束编辑</p>
      </div>
    </aside>

    <!-- map -->
    <main class="flex-1 relative">
      <div ref="mapEl" class="absolute inset-0"></div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import OlMap from 'ol/Map.js'
import View from 'ol/View.js'
import { useGeographic } from 'ol/proj.js'
import TileLayer from 'ol/layer/Tile.js'
import XYZ from 'ol/source/XYZ.js'
import { OlDrawUtil } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'
import { MlDrawUtil } from '@loongbao-web-gis-utils/draw-utils-base-maplibre'
import { DrawState } from '@loongbao-web-gis-utils/draw-utils-base-core'
import type { FeatureInfo, FeatureType } from '@loongbao-web-gis-utils/draw-utils-base-openlayer'

const mapEl = ref<HTMLElement>()
const state = ref<DrawState>(DrawState.IDLE)
const features = ref<FeatureInfo[]>([])
const selectedId = ref<string | number | null>(null)
const creatingType = ref<FeatureType | null>(null)
const framework = ref<'ol' | 'ml'>('ol')
let drawUtil: OlDrawUtil | MlDrawUtil
let idCounter = 0
let olMap: any = null
let mlMap: any = null

const iconPresets = [
  'none',
  'red',
  'blue',
  'green',
  'orange',
  'purple',
]

const featureTypes = [
  { label: '📍 点', value: 'point' as FeatureType },
  { label: '📏 线段', value: 'line' as FeatureType },
  { label: '🔲 矩形', value: 'rect' as FeatureType },
  { label: '🔺 三角形', value: 'triangle' as FeatureType },
  { label: '⭕ 圆形', value: 'circle' as FeatureType },
  { label: '📐 折线', value: 'polyline' as FeatureType },
  { label: '⬡ 自定义封闭图形', value: 'customShape' as FeatureType },
]

const selectedFeature = computed(() => {
  if (!selectedId.value) return null
  return features.value.find(f => f.id === selectedId.value) || null
})

const isPointType = computed(() => selectedFeature.value?.type === 'point')
const hasLineStyle = computed(() => !isPointType.value)
const hasFillRgba = computed(() => {
  const t = selectedFeature.value?.type
  return t === 'rect' || t === 'triangle' || t === 'circle' || t === 'customShape'
})

interface EditableDetail {
  name?: string; iconSrc?: string; lineWidth?: number; lineType?: string
  lineRgba?: string; fillRgba?: string; textRgba?: string; radius?: number
}
const editingFeature = ref<FeatureInfo | null>(null)
const editDetail = ref<EditableDetail>({})

const fillRgbaModel = ref('')

function rgbaToHex(rgba: string): string {
  const m = rgba.match(/[\d.]+/g)
  if (!m || m.length < 3) return '#000000'
  const r = (+m[0]).toString(16).padStart(2, '0')
  const g = (+m[1]).toString(16).padStart(2, '0')
  const b = (+m[2]).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}
function hexToRgba(hex: string, alpha = '1'): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return 'rgba(0,0,0,1)'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = parseFloat(alpha)
  return `rgba(${r},${g},${b},${isNaN(a) ? 1 : a})`
}

const lineHex = computed({
  get: () => rgbaToHex(editDetail.value.lineRgba || '#000'),
  set: (v: string) => { editDetail.value.lineRgba = hexToRgba(v) },
})
const fillHex = computed({
  get: () => rgbaToHex(fillRgbaModel.value || '#fff'),
  set: (v: string) => { fillRgbaModel.value = hexToRgba(v) },
})
const textHex = computed({
  get: () => rgbaToHex(editDetail.value.textRgba || '#000'),
  set: (v: string) => { editDetail.value.textRgba = hexToRgba(v) },
})

function selectFeature(f: FeatureInfo) {
  selectedId.value = f.id
  editingFeature.value = { ...f, detail: { ...f.detail } }
  editDetail.value = { ...f.detail } as EditableDetail
  fillRgbaModel.value = (f.detail as any).fillRgba || 'rgba(255,255,255,0.3)'
}

function applyProperties() {
  if (!editingFeature.value || !editingFeature.value.wkt) return
  const feat = editingFeature.value
  const detail = { ...editDetail.value }
  if (fillRgbaModel.value) (detail as any).fillRgba = fillRgbaModel.value
  if (feat.type === 'circle' && editDetail.value.radius != null) (detail as any).radius = editDetail.value.radius

  const updated: FeatureInfo = { ...feat, detail } as FeatureInfo
  drawUtil.modifyFeature(updated)
  const idx = features.value.findIndex(f => f.id === updated.id)
  if (idx >= 0) features.value[idx] = { ...updated }
}

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
  const area = { lineWidth: 2, lineType: 'solid' as const, lineRgba: 'rgba(0,100,255,1)', fillRgba: 'rgba(0,100,255,0.2)' }
  switch (type) {
    case 'point': return { iconSrc: 'red', fillRgba: 'rgba(255,60,60,0.7)', ...base }
    case 'line': return { lineWidth: 2, lineType: 'solid' as const, lineRgba: 'rgba(255,60,60,1)', ...base }
    case 'rect': return { ...area }
    case 'triangle': return { ...area, lineRgba: 'rgba(60,180,60,1)', fillRgba: 'rgba(60,180,60,0.2)' }
    case 'circle': return { radius: 500, ...area, lineRgba: 'rgba(255,180,0,1)', fillRgba: 'rgba(255,180,0,0.2)' }
    case 'polyline': return { lineWidth: 2, lineType: 'dashed' as const, lineRgba: 'rgba(160,60,240,1)', ...base }
    case 'customShape': return { ...area, lineRgba: 'rgba(240,100,60,1)', fillRgba: 'rgba(240,100,60,0.2)' }
    default: return {}
  }
}

function onPickUp(hits: FeatureInfo[]) {
  for (const h of hits) {
    if (h.id != null) selectFeature(h)
  }
}
function onCreated(f: FeatureInfo) {
  console.log(f)
  state.value = drawUtil.getState(); creatingType.value = null
  const idx = features.value.findIndex(x => x.id === f.id)
  if (idx >= 0) features.value[idx] = { ...f }; else features.value.push({ ...f })
}
function onEdited(f: FeatureInfo) {
  state.value = drawUtil.getState()
  const idx = features.value.findIndex(x => x.id === f.id)
  if (idx >= 0) features.value[idx] = { ...f }
}
function startCreate(type: FeatureType) {
  if (state.value !== DrawState.IDLE) return
  creatingType.value = type
  idCounter++
  drawUtil.createFeature({ id: `${type}-${idCounter}`, type, detail: defaultDetail(type) }, onCreated)
  state.value = drawUtil.getState()
}
function toggleEdit() {
  if (state.value !== DrawState.IDLE || !selectedId.value) return
  const f = features.value.find(x => x.id === selectedId.value)
  if (!f || !f.wkt) return
  drawUtil.updateFeature({ ...f }, onEdited)
  state.value = drawUtil.getState()
}
function deleteSelected() {
  if (state.value !== DrawState.IDLE || !selectedId.value) return
  drawUtil.deleteFeature(selectedId.value)
  features.value = features.value.filter(x => x.id !== selectedId.value)
  selectedId.value = null
}
function clearAll() {
  drawUtil.clear((cleared) => {
    features.value = features.value.filter(f => !cleared!.find(c => c.id === f.id))
  })
  selectedId.value = null; state.value = DrawState.IDLE
}

function initOlMap() {
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
  olMap = map
  drawUtil = new OlDrawUtil(map, onPickUp)
  // OL 事件在外部绑定，因为 OlDrawUtil 不自动绑定
  map.on('click', (e: any) => {
    drawUtil.click([e.coordinate[0], e.coordinate[1]])
    state.value = drawUtil.getState(); if (state.value === DrawState.IDLE) creatingType.value = null
  })
  map.on('dblclick', (e: any) => {
    drawUtil.dblclick([e.coordinate[0], e.coordinate[1]])
    state.value = drawUtil.getState(); if (state.value === DrawState.IDLE) creatingType.value = null
  })
  let moveTimer: ReturnType<typeof setTimeout> | null = null
  map.on('pointermove', (e: any) => {
    if (moveTimer) return
    moveTimer = setTimeout(() => { moveTimer = null; drawUtil.move([e.coordinate[0], e.coordinate[1]]) }, 50)
  })
}

async function initMlMap() {
  if (!mapEl.value) return
  await new Promise(r => requestAnimationFrame(r))
  // 确保容器有非零尺寸
  const el = mapEl.value
  el.style.width = '100%'
  el.style.height = '100%'
  const { default: ml } = await import('maplibre-gl')
  const tileUrl = 'https://wprd01.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7'
  const map = new ml.Map({
    container: mapEl.value,
    style: { version: 8, sources: { gaode: { type: 'raster', tiles: [tileUrl], tileSize: 256, minzoom: 1, maxzoom: 18 } }, layers: [{ id: 'gaode', type: 'raster', source: 'gaode' }] },
    center: [110.0, 19.0],
    zoom: 8,
  })
  map.resize()
  mlMap = map
  // 静默处理 MapLibre 5.24 setData 触发的 raster 源级联崩溃 bug
  map.on('error', (e: any) => { if (e?.error?.message?.includes('join')) return; console.error(e) })
  drawUtil = new MlDrawUtil(map, onPickUp)
  map.on('click', (e: any) => {
    drawUtil.click([e.lngLat.lng, e.lngLat.lat])
    state.value = drawUtil.getState(); if (state.value === DrawState.IDLE) creatingType.value = null
  })
  map.on('dblclick', (e: any) => {
    drawUtil.dblclick([e.lngLat.lng, e.lngLat.lat])
    state.value = drawUtil.getState(); if (state.value === DrawState.IDLE) creatingType.value = null
  })
  let moveTimer: ReturnType<typeof setTimeout> | null = null
  map.on('mousemove', (e: any) => {
    if (moveTimer) return
    moveTimer = setTimeout(() => { moveTimer = null; drawUtil.move([e.lngLat.lng, e.lngLat.lat]) }, 50)
  })
}

function switchFramework(fw: 'ol' | 'ml') {
  if (olMap) { olMap.setTarget(undefined); olMap = null }
  if (mlMap) { mlMap.remove(); mlMap = null }
  features.value = []; selectedId.value = null
  if (fw === 'ol') initOlMap()
  else initMlMap()
}

watch(framework, switchFramework)

onMounted(() => {
  useGeographic()
  initOlMap()
})
</script>
