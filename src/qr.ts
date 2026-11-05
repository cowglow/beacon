// Minimal QR Code encoder: byte mode, error-correction level M, versions 1–40,
// automatic mask selection. Written in-house (adapted from the reference
// algorithm in ISO/IEC 18004) so the app stays dependency-free.

// Per-version tables for ECC level M (index 0 unused).
const ECC_CODEWORDS_PER_BLOCK = [
  -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
]
const NUM_ECC_BLOCKS = [
  -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31,
  33, 35, 37, 38, 40, 43, 45, 47, 49,
]
const ECL_FORMAT_BITS_M = 0

/** Returns the module grid (true = dark), without quiet zone. */
export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))

  let version = 1
  for (; ; version++) {
    if (version > 40) throw new Error('Text too long for a QR code')
    const countBits = version <= 9 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= getNumDataCodewords(version) * 8) break
  }

  // Build the data bitstream.
  const bits: number[] = []
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version <= 9 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const capacityBits = getNumDataCodewords(version) * 8
  push(0, Math.min(4, capacityBits - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]
    data.push(byte)
  }

  const qr = new QrMatrix(version)
  qr.drawCodewords(addEccAndInterleave(data, version))

  let bestMask = 0
  let minPenalty = Infinity
  for (let mask = 0; mask < 8; mask++) {
    qr.applyMask(mask)
    qr.drawFormatBits(mask)
    const penalty = qr.penalty()
    if (penalty < minPenalty) {
      minPenalty = penalty
      bestMask = mask
    }
    qr.applyMask(mask) // XOR again to undo
  }
  qr.applyMask(bestMask)
  qr.drawFormatBits(bestMask)
  return qr.modules
}

/** Renders text as a crisp black-on-white SVG QR code string. */
export function qrSvg(text: string): string {
  const modules = encodeQr(text)
  const quiet = 4
  const size = modules.length + quiet * 2
  let path = ''
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x + quiet},${y + quiet}h1v1h-1z`
    }),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
}

function getNumRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (ver >= 7) result -= 36
  }
  return result
}

function getNumDataCodewords(ver: number): number {
  return Math.floor(getNumRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ver] * NUM_ECC_BLOCKS[ver]
}

function addEccAndInterleave(data: number[], ver: number): number[] {
  const numBlocks = NUM_ECC_BLOCKS[ver]
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ver]
  const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)

  const divisor = rsDivisor(blockEccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShortBlocks) dat.push(0)
    blocks.push(dat.concat(ecc))
  }

  const result: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i])
    })
  }
  return result
}

function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)))
  }
  return result
}

class QrMatrix {
  readonly size: number
  readonly modules: boolean[][]
  private readonly isFunction: boolean[][]
  private readonly version: number

  constructor(version: number) {
    this.version = version
    this.size = version * 4 + 17
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.drawFunctionPatterns()
  }

  private set(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark
    this.isFunction[y][x] = true
  }

  private drawFunctionPatterns() {
    const { size } = this
    for (let i = 0; i < size; i++) {
      this.set(6, i, i % 2 === 0)
      this.set(i, 6, i % 2 === 0)
    }
    this.drawFinder(3, 3)
    this.drawFinder(size - 4, 3)
    this.drawFinder(3, size - 4)

    const pos = this.alignmentPositions()
    const last = pos.length - 1
    pos.forEach((a, i) =>
      pos.forEach((b, j) => {
        if (!((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0))) this.drawAlignment(a, b)
      }),
    )

    this.drawFormatBits(0) // reserve; overwritten after masking
    this.drawVersion()
  }

  private drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.set(xx, yy, dist !== 2 && dist !== 4)
      }
    }
  }

  private drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }

  private alignmentPositions(): number[] {
    if (this.version === 1) return []
    const numAlign = Math.floor(this.version / 7) + 2
    const step = Math.floor((this.version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2
    const result = [6]
    for (let p = this.size - 7; result.length < numAlign; p -= step) result.splice(1, 0, p)
    return result
  }

  drawFormatBits(mask: number) {
    const data = (ECL_FORMAT_BITS_M << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((bits >>> i) & 1) !== 0
    const { size } = this

    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i))
    this.set(8, 7, bit(6))
    this.set(8, 8, bit(7))
    this.set(7, 8, bit(8))
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i))

    for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(i))
    this.set(8, size - 8, true)
  }

  private drawVersion() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.set(a, b, dark)
      this.set(b, a, dark)
    }
  }

  drawCodewords(data: number[]) {
    const { size } = this
    let i = 0
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? size - 1 - vert : vert
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
            i++
          }
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break
          case 1: invert = y % 2 === 0; break
          case 2: invert = x % 3 === 0; break
          case 3: invert = (x + y) % 3 === 0; break
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break
        }
        if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x]
      }
    }
  }

  penalty(): number {
    const { size, modules } = this
    let result = 0
    const at = (x: number, y: number, horizontal: boolean) => (horizontal ? modules[y][x] : modules[x][y])

    for (const horizontal of [true, false]) {
      for (let a = 0; a < size; a++) {
        // Rule 1: runs of 5+ same-colored modules.
        let runLen = 1
        for (let b = 1; b < size; b++) {
          if (at(b, a, horizontal) === at(b - 1, a, horizontal)) {
            runLen++
          } else {
            if (runLen >= 5) result += runLen - 2
            runLen = 1
          }
        }
        if (runLen >= 5) result += runLen - 2

        // Rule 3: finder-like 1:1:3:1:1 pattern with 4 light modules on a side.
        for (let b = 0; b + 11 <= size; b++) {
          const s = Array.from({ length: 11 }, (_, k) => at(b + k, a, horizontal))
          const core = s[4] && !s[5] && s[6] && s[7] && s[8] && !s[9] && s[10]
          const coreRev = s[0] && !s[1] && s[2] && s[3] && s[4] && !s[5] && s[6]
          if ((core && !s[0] && !s[1] && !s[2] && !s[3]) || (coreRev && !s[7] && !s[8] && !s[9] && !s[10])) result += 40
        }
      }
    }

    // Rule 2: 2×2 blocks of one color.
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = modules[y][x]
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += 3
      }
    }

    // Rule 4: dark/light balance.
    let dark = 0
    for (const row of modules) for (const m of row) if (m) dark++
    const total = size * size
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    result += k * 10
    return result
  }
}
