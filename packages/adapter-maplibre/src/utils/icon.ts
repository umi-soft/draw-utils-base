const ICON_CACHE: Record<string, string> = {}

function createMarkerPNG(color: string): string {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.globalAlpha = 0.85; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(32, 28, 24, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(32, 28, 18, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(32, 28, 10, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.85; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(32, 60); ctx.lineTo(22, 40); ctx.lineTo(42, 40); ctx.closePath(); ctx.fill()
  return canvas.toDataURL('image/png')
}

export function getBuiltinIcon(color: string): string {
  if (ICON_CACHE[color]) return ICON_CACHE[color]
  try { const uri = createMarkerPNG(color); ICON_CACHE[color] = uri; return uri }
  catch { return '' }
}
