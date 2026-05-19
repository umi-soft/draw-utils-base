const ICON_CACHE: Record<string, string> = {}

function createMarkerPNG(color: string): string {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // 圆点主体
  ctx.globalAlpha = 0.85
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(32, 28, 24, 0, Math.PI * 2)
  ctx.fill()

  // 白色内圈
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(32, 28, 18, 0, Math.PI * 2)
  ctx.fill()

  // 中心色块
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(32, 28, 10, 0, Math.PI * 2)
  ctx.fill()

  // 底部尖角
  ctx.globalAlpha = 0.85
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(32, 60)
  ctx.lineTo(22, 40)
  ctx.lineTo(42, 40)
  ctx.closePath()
  ctx.fill()

  return canvas.toDataURL('image/png')
}

/** 获取预制的 PNG data-URI 图标（Canvas2D 绘制，OL 原生支持） */
export function getBuiltinIcon(color: string): string {
  const key = color
  if (ICON_CACHE[key]) return ICON_CACHE[key]
  try {
    const uri = createMarkerPNG(color)
    ICON_CACHE[key] = uri
    return uri
  } catch {
    return ''
  }
}
