// vitest setup - mock DOM APIs for Node environment
if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
  const mockCtx = {
    arc() {}, beginPath() {}, closePath() {}, fill() {}, moveTo() {}, lineTo() {},
    globalAlpha: 1, fillStyle: '#000',
  }
  const mockCanvas = () => ({
    width: 0, height: 0,
    getContext(_t: string) { return mockCtx },
    toDataURL() { return 'data:image/png;base64,mock' },
  })
  ;(globalThis as any).document = {
    createElement(tag: string) {
      if (tag === 'canvas') return mockCanvas()
      if (tag === 'img') return { src: '', onload: null, onerror: null }
      return {}
    },
  }
}

if (typeof Image === 'undefined') {
  ;(globalThis as any).Image = class {
    src = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
  }
}
