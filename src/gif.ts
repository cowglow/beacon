export type GifColor = [red: number, green: number, blue: number]

export interface GifFrame {
  pixels: Uint8Array
  delay: number // hundredths of a second
}

// GIF LZW uses the palette indices as its initial dictionary. Codes are
// packed least-significant bit first, growing from 9 to at most 12 bits.
function compress(pixels: Uint8Array): number[] {
  const clear = 256
  const end = 257
  const dictionary = new Map<number, number>()
  const bytes: number[] = []
  let nextCode = end + 1
  let codeSize = 9
  let buffer = 0
  let bits = 0

  function write(code: number) {
    buffer |= code << bits
    bits += codeSize
    while (bits >= 8) {
      bytes.push(buffer & 0xff)
      buffer >>= 8
      bits -= 8
    }
    // The decoder adds each dictionary entry one output code later.
    if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++
  }

  write(clear)
  let prefix = pixels[0]
  for (let i = 1; i < pixels.length; i++) {
    const pixel = pixels[i]
    const key = (prefix << 8) | pixel
    const code = dictionary.get(key)
    if (code !== undefined) {
      prefix = code
      continue
    }

    write(prefix)
    if (nextCode < 4096) {
      dictionary.set(key, nextCode++)
    } else {
      write(clear)
      dictionary.clear()
      nextCode = end + 1
      codeSize = 9
    }
    prefix = pixel
  }
  write(prefix)
  write(end)
  if (bits) bytes.push(buffer & 0xff)
  return bytes
}

export function encodeGif(width: number, height: number, palette: GifColor[], frames: GifFrame[]): Blob {
  const bytes: number[] = []
  const word = (n: number) => bytes.push(n & 0xff, n >> 8)
  const ascii = (s: string) => bytes.push(...Array.from(s, (c) => c.charCodeAt(0)))

  ascii('GIF89a')
  word(width)
  word(height)
  bytes.push(0xf7, 0, 0) // 256-entry global color table
  for (let i = 0; i < 256; i++) bytes.push(...(palette[i] ?? [0, 0, 0]))

  bytes.push(0x21, 0xff, 11)
  ascii('NETSCAPE2.0')
  bytes.push(3, 1, 0, 0, 0) // loop indefinitely

  for (const { pixels, delay } of frames) {
    bytes.push(0x21, 0xf9, 4, 4)
    word(delay)
    bytes.push(0, 0)
    bytes.push(0x2c, 0, 0, 0, 0)
    word(width)
    word(height)
    bytes.push(0, 8) // use the global palette and 8-bit minimum LZW code size
    const compressed = compress(pixels)
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.slice(offset, offset + 255)
      bytes.push(block.length, ...block)
    }
    bytes.push(0)
  }

  bytes.push(0x3b)
  return new Blob([Uint8Array.from(bytes)], { type: 'image/gif' })
}
