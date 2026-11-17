import type { DisplayColors } from './display.ts'
import { encodeGif, type GifColor, type GifFrame } from './gif.ts'
import type { DisplayMode } from './types.ts'

const WIDTH = 640
const HEIGHT = 360
const PADDING = 24
const SHADES = 16
const COLOR_STEP = 51
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function wrapText(context: CanvasRenderingContext2D, text: string): string[] {
  const fits = (line: string) => context.measureText(line).width <= WIDTH - 2 * PADDING
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.match(/\S+/g) ?? []) {
      const combined = line ? `${line} ${word}` : word
      if (fits(combined)) {
        line = combined
        continue
      }
      if (line) lines.push(line)
      line = ''
      // Break long words at grapheme boundaries, keeping emoji sequences intact.
      const segments = segmenter ? Array.from(segmenter.segment(word), ({ segment }) => segment) : Array.from(word)
      for (const segment of segments) {
        if (line && !fits(line + segment)) {
          lines.push(line)
          line = ''
        }
        line += segment
      }
    }
    lines.push(line)
  }
  return lines
}

function toRgb(hex: string): GifColor {
  const rgb = Number.parseInt(hex.slice(1), 16)
  return [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]
}

function makePalette(colors: DisplayColors): GifColor[] {
  const bg = toRgb(colors.bg)
  const fg = toRgb(colors.fg)
  const palette: GifColor[] = []
  for (let i = 0; i < SHADES; i++) {
    const blend = (channel: number) => Math.round(bg[channel] + (fg[channel] - bg[channel]) * i / (SHADES - 1))
    palette.push([blend(0), blend(1), blend(2)])
  }
  // Keep shades between the sign colors for smooth text edges, plus a color
  // cube for glyphs that have their own colors, such as emoji.
  for (let r = 0; r <= 255; r += COLOR_STEP) {
    for (let g = 0; g <= 255; g += COLOR_STEP) {
      for (let b = 0; b <= 255; b += COLOR_STEP) palette.push([r, g, b])
    }
  }
  return palette
}

function indexPixels(rgba: Uint8ClampedArray, palette: GifColor[]): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT)
  const indices = new Map<number, number>()
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i]
    const g = rgba[i + 1]
    const b = rgba[i + 2]
    const color = (r << 16) | (g << 8) | b
    let index = indices.get(color)
    if (index === undefined) {
      const distance = ([red, green, blue]: GifColor) => (r - red) ** 2 + (g - green) ** 2 + (b - blue) ** 2
      const cubeRed = Math.round(r / COLOR_STEP)
      const cubeGreen = Math.round(g / COLOR_STEP)
      const cubeBlue = Math.round(b / COLOR_STEP)
      index = SHADES + cubeRed * 36 + cubeGreen * 6 + cubeBlue
      let closest = distance(palette[index])
      for (let shade = 0; shade < SHADES; shade++) {
        const delta = distance(palette[shade])
        if (delta <= closest) {
          closest = delta
          index = shade
        }
      }
      indices.set(color, index)
    }
    pixels[i / 4] = index
  }
  return pixels
}

export function createSignGif(text: string, colors: DisplayColors, mode: DisplayMode): Blob {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
  if (!context) throw new Error('Canvas is unavailable')

  const family = getComputedStyle(document.body).fontFamily
  const wrapAtSize = (size: number) => {
    context.font = `900 ${size}px ${family}`
    return wrapText(context, text)
  }
  let minSize = 1
  let maxSize = 180
  while (minSize < maxSize) {
    const size = Math.ceil((minSize + maxSize) / 2)
    if (wrapAtSize(size).length * size * 1.1 <= HEIGHT - 2 * PADDING) minSize = size
    else maxSize = size - 1
  }
  const lines = wrapAtSize(minSize)
  const lineHeight = minSize * 1.1

  const palette = makePalette(colors)
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  const render = (background: string, foreground: string) => {
    context.fillStyle = background
    context.fillRect(0, 0, WIDTH, HEIGHT)
    context.fillStyle = foreground
    const top = (HEIGHT - (lines.length - 1) * lineHeight) / 2
    lines.forEach((line, i) => context.fillText(line, WIDTH / 2, top + i * lineHeight))
    return indexPixels(context.getImageData(0, 0, WIDTH, HEIGHT).data, palette)
  }

  const sign = render(colors.bg, colors.fg)
  if (mode === 'blink') {
    return encodeGif(WIDTH, HEIGHT, palette, [
      { pixels: sign, delay: 25 },
      { pixels: render(colors.fg, colors.bg), delay: 25 },
    ])
  }

  const frames: GifFrame[] = [{ pixels: new Uint8Array(sign.length), delay: 15 }]
  for (let step = 1; step < 8; step++) {
    const edge = WIDTH * step / 8
    const pixels = new Uint8Array(sign.length)
    for (let row = 0; row < sign.length; row += WIDTH) {
      pixels.set(sign.subarray(row, row + edge), row)
    }
    frames.push({ pixels, delay: 8 })
  }
  frames.push({ pixels: sign, delay: 110 })
  return encodeGif(WIDTH, HEIGHT, palette, frames)
}
