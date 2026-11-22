import { AppError } from "./errors"
import { stripJpegMetadata, stripPngMetadata } from "./metadata"

// Client-only image compression. Runs inside a Web Worker when possible,
// otherwise on the main thread. Nothing here ever touches the network.

export type ImageKind = "photo" | "signature" | "document"
export type OutputFormat = "image/jpeg" | "image/png"

export interface CompressOptions {
  kind: ImageKind
  /** Upper limit in bytes. The result is always <= this. */
  maxBytes: number
  /** Optional lower limit in bytes. */
  minBytes?: number
  /** Exact output size in pixels. Both must be set to take effect. */
  width?: number
  height?: number
  format: OutputFormat
  /** Signature only: trim empty margins and whiten the paper. */
  cleanSignature: boolean
  /** Document only: whiten the paper and darken the text (black & white). */
  cleanDocument?: boolean
}

export interface CompressResult {
  blob: Blob
  width: number
  height: number
  /** JPEG quality used (0–1), null for PNG or a kept original. */
  quality: number | null
  /** The original already fit, so its image data was kept as is. */
  kept?: boolean
}

export { AppError as CompressError }

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
// Both context types share the API we use; typing them as one keeps TS happy.
type Ctx = OffscreenCanvasRenderingContext2D

/** Largest side we keep in memory while working. Phone photos can be 8000px+. */
const WORK_MAX_SIDE = 2000

// Never shrink below these: a face, a signature, a page of text still readable.
const MIN_LONG_SIDE: Record<ImageKind, number> = { photo: 100, signature: 80, document: 600 }
const MAX_UPSCALE_SIDE = 1600

/** Below this JPEG quality we prefer fewer pixels over more artifacts. */
const GOOD_QUALITY = 0.6
/** When winning back pixels, never drop below this JPEG quality to do it. */
const REFINE_QUALITY = 0.75
const MAX_QUALITY = 0.95
const FLOOR_QUALITY = 0.05
const SHRINK_STEP = 0.85

export async function compressImage(
  file: Blob,
  opts: CompressOptions
): Promise<CompressResult> {
  if (opts.minBytes && opts.minBytes > opts.maxBytes) {
    throw new AppError("minOverMax")
  }

  const kept = await keepAsIs(file, opts)
  if (kept) return kept

  let source = await decode(file)
  if (opts.kind === "signature" && opts.cleanSignature) {
    source = cleanInk(source, { trim: true })
  } else if (opts.kind === "document" && opts.cleanDocument) {
    // Never crop a document: a faint stamp or edge note could be cut off.
    source = cleanInk(source, { trim: false })
  }

  const fixed = opts.width && opts.height ? { w: opts.width, h: opts.height } : null
  const result = fixed
    ? await fitFixedSize(source, fixed.w, fixed.h, opts)
    : await fitFlexibleSize(source, opts)

  if (opts.minBytes && result.blob.size < opts.minBytes) {
    return padToMinimum(result, opts.minBytes, opts.maxBytes)
  }
  return result
}

// ---------------------------------------------------------------------------
// Already fits: keep the image, drop only hidden metadata

/**
 * If the original is already in the chosen format and inside the size range,
 * and no change to the picture was asked for, re-encoding would only lose
 * quality (and can even make the file bigger). Keep its image data instead,
 * minus location/camera metadata.
 */
async function keepAsIs(file: Blob, opts: CompressOptions): Promise<CompressResult | null> {
  const changesPicture =
    (opts.width && opts.height) ||
    (opts.kind === "signature" && opts.cleanSignature) ||
    (opts.kind === "document" && opts.cleanDocument)
  if (changesPicture || file.size > opts.maxBytes * 1.5) return null

  const bytes = new Uint8Array(await file.arrayBuffer())
  const stripped =
    opts.format === "image/jpeg" ? stripJpegMetadata(bytes) : stripPngMetadata(bytes)
  if (!stripped) return null
  if (stripped.length > opts.maxBytes) return null
  if (opts.minBytes && stripped.length < opts.minBytes) return null

  const blob = new Blob([stripped as Uint8Array<ArrayBuffer>], { type: opts.format })
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob)
  } catch {
    return null // something about the file is off; fall back to re-encoding
  }
  const { width, height } = bitmap
  bitmap.close()
  return { blob, width, height, quality: null, kept: true }
}

// ---------------------------------------------------------------------------
// Decoding

/** Decode with EXIF rotation applied, flattened on white, capped at WORK_MAX_SIDE. */
export async function decode(file: Blob): Promise<AnyCanvas> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    throw new AppError("decode")
  }
  const scale = Math.min(1, WORK_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = createCanvas(w, h)
  const ctx = getContext(canvas)
  // White background so transparent PNG areas don't turn black in JPEG.
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas
}

// ---------------------------------------------------------------------------
// Ink cleanup (signatures, documents): whiten paper, darken ink, optionally
// trim the empty margins around the ink.

function cleanInk(src: AnyCanvas, { trim }: { trim: boolean }): AnyCanvas {
  const { width: w, height: h } = src
  const ctx = getContext(src)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const n = w * h

  const lum = new Uint8ClampedArray(n)
  const hist = new Uint32Array(256)
  for (let i = 0; i < n; i++) {
    const v = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])
    lum[i] = v
    hist[v]++
  }
  const paper = percentile(hist, n, 0.6)
  const ink = percentile(hist, n, 0.01)
  if (paper - ink < 40) return src // too little contrast to tell ink from paper

  const inkThreshold = ink + (paper - ink) * 0.55
  const whitePoint = ink + (paper - ink) * 0.85

  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const v = lum[i]
      if (v < inkThreshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      // Stretch contrast: paper becomes pure white, ink becomes near black.
      const t = Math.min(1, Math.max(0, (v - ink) / (whitePoint - ink)))
      const out = Math.round(255 * t * t)
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = out
      d[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  if (!trim || maxX < 0) return src

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06) + 4
  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const x1 = Math.min(w, maxX + pad + 1)
  const y1 = Math.min(h, maxY + pad + 1)
  const out = createCanvas(x1 - x0, y1 - y0)
  getContext(out).drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0)
  return out
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= target) return v
  }
  return 255
}

// ---------------------------------------------------------------------------
// Size fitting

/** Exact pixel size requested: center-crop to that aspect ratio, then search quality. */
async function fitFixedSize(
  src: AnyCanvas,
  w: number,
  h: number,
  opts: CompressOptions
): Promise<CompressResult> {
  const canvas = render(src, w, h, true)
  const res = await bestUnderLimit(canvas, opts.format, opts.maxBytes, FLOOR_QUALITY)
  if (!res) {
    throw new AppError("fixedTooBig", { w, h })
  }
  if (opts.minBytes && res.blob.size < opts.minBytes && opts.format === "image/jpeg") {
    const max = await encode(canvas, opts.format, 1)
    if (max.size <= opts.maxBytes) return { ...res, blob: max, quality: 1 }
  }
  return res
}

/** Free pixel size: keep quality high, shrink dimensions only when needed. */
async function fitFlexibleSize(src: AnyCanvas, opts: CompressOptions): Promise<CompressResult> {
  // Start at full resolution (decode already capped it at WORK_MAX_SIDE) so the
  // result uses as much of the size budget as possible.
  let long = Math.max(src.width, src.height)
  const minLong = Math.min(long, MIN_LONG_SIDE[opts.kind])
  let tooBig = 0 // smallest long side known not to fit

  for (;;) {
    const canvas = renderLongSide(src, long)
    const atMin = long <= minLong
    const res = await bestUnderLimit(
      canvas,
      opts.format,
      opts.maxBytes,
      atMin ? FLOOR_QUALITY : GOOD_QUALITY
    )
    if (res) {
      // After shrinking, a result well under the limit means we shrank too far:
      // win back pixels until it lands close to the budget.
      const best =
        tooBig && res.blob.size < opts.maxBytes * 0.95
          ? await growWithinLimit(src, long, tooBig, res, opts)
          : res
      if (opts.minBytes && best.blob.size < opts.minBytes) {
        return growToMinimum(src, Math.max(best.width, best.height), best, opts)
      }
      return best
    }
    if (atMin) break
    tooBig = long
    // File size grows roughly with pixel count, so jump straight to about the
    // size that should fit instead of shrinking in small steps.
    const probe = await encode(canvas, opts.format, opts.format === "image/jpeg" ? 0.8 : undefined)
    const estimate = Math.round(long * Math.sqrt(opts.maxBytes / probe.size))
    long = Math.max(minLong, Math.min(Math.round(long * SHRINK_STEP), estimate))
  }
  throw new AppError(opts.format === "image/png" ? "tooBigPng" : "tooBig")
}

/** Bisect the long side between a size that fits and one that doesn't. */
async function growWithinLimit(
  src: AnyCanvas,
  fits: number,
  tooBig: number,
  current: CompressResult,
  opts: CompressOptions
): Promise<CompressResult> {
  let lo = fits
  let hi = tooBig
  let best = current
  for (let i = 0; i < 5 && hi - lo > 8; i++) {
    const mid = Math.round((lo + hi) / 2)
    const res = await bestUnderLimit(renderLongSide(src, mid), opts.format, opts.maxBytes, REFINE_QUALITY)
    // Only trade quality for pixels while it also gets closer to the budget.
    if (res && res.blob.size >= best.blob.size) {
      best = res
      lo = mid
    } else {
      hi = mid
    }
  }
  return best
}

/** Result is under the minimum: add pixels until it's within range. */
async function growToMinimum(
  src: AnyCanvas,
  startLong: number,
  current: CompressResult,
  opts: CompressOptions
): Promise<CompressResult> {
  const min = opts.minBytes!
  let best = current
  let long = startLong
  while (long < MAX_UPSCALE_SIDE) {
    long = Math.min(MAX_UPSCALE_SIDE, Math.round(long * 1.2))
    const canvas = renderLongSide(src, long)
    const res = await bestUnderLimit(canvas, opts.format, opts.maxBytes, FLOOR_QUALITY)
    if (!res) break
    best = res
    if (res.blob.size >= min) return res
  }
  return best
}

/**
 * Last resort for JPEG: a valid comment segment adds bytes without changing
 * the picture, so tiny images can still meet a portal's minimum size.
 */
async function padToMinimum(
  res: CompressResult,
  minBytes: number,
  maxBytes: number
): Promise<CompressResult> {
  if (res.blob.type !== "image/jpeg") return res
  const target = Math.min(maxBytes, minBytes + 512)
  let missing = target - res.blob.size
  const segments: Uint8Array<ArrayBuffer>[] = []
  while (missing > 4) {
    const payload = Math.min(65533, missing - 4)
    const seg = new Uint8Array(payload + 4)
    seg[0] = 0xff
    seg[1] = 0xfe // COM marker
    seg[2] = ((payload + 2) >> 8) & 0xff
    seg[3] = (payload + 2) & 0xff
    seg.fill(0x20, 4) // spaces
    segments.push(seg)
    missing -= seg.length
  }
  // Insert right after the SOI marker (first 2 bytes).
  const blob = new Blob([res.blob.slice(0, 2), ...segments, res.blob.slice(2)], {
    type: "image/jpeg",
  })
  return { ...res, blob }
}

/** Highest quality (>= floor) whose encoded size fits, or null if none does. */
export async function bestUnderLimit(
  canvas: AnyCanvas,
  format: OutputFormat,
  maxBytes: number,
  floor: number
): Promise<CompressResult | null> {
  const { width, height } = canvas
  if (format === "image/png") {
    const blob = await encode(canvas, format)
    return blob.size <= maxBytes ? { blob, width, height, quality: null } : null
  }

  const top = await encode(canvas, format, MAX_QUALITY)
  if (top.size <= maxBytes) return { blob: top, width, height, quality: MAX_QUALITY }

  const bottom = await encode(canvas, format, floor)
  if (bottom.size > maxBytes) return null

  let lo = floor
  let hi = MAX_QUALITY
  let best: Blob = bottom
  let bestQ = floor
  for (let i = 0; i < 7; i++) {
    const q = (lo + hi) / 2
    const blob = await encode(canvas, format, q)
    if (blob.size <= maxBytes) {
      best = blob
      bestQ = q
      lo = q
    } else {
      hi = q
    }
  }
  return { blob: best, width, height, quality: Math.round(bestQ * 100) / 100 }
}

// ---------------------------------------------------------------------------
// Canvas helpers

function renderLongSide(src: AnyCanvas, long: number): AnyCanvas {
  const scale = long / Math.max(src.width, src.height)
  const w = Math.max(1, Math.round(src.width * scale))
  const h = Math.max(1, Math.round(src.height * scale))
  return render(src, w, h, false)
}

/** Draw src into a w×h canvas. With crop, fill the frame and trim the overflow evenly. */
function render(src: AnyCanvas, w: number, h: number, crop: boolean): AnyCanvas {
  let sx = 0, sy = 0, sw = src.width, sh = src.height
  if (crop) {
    const target = w / h
    if (sw / sh > target) {
      sw = Math.round(sh * target)
      sx = Math.round((src.width - sw) / 2)
    } else {
      sh = Math.round(sw / target)
      sy = Math.round((src.height - sh) / 2)
    }
  }
  // Step down in halves for big reductions; one-pass downscaling looks jagged.
  let cur: AnyCanvas = src
  let cx = sx, cy = sy, cw = sw, ch = sh
  while (cw / 2 > w && ch / 2 > h) {
    const half = createCanvas(Math.round(cw / 2), Math.round(ch / 2))
    const hctx = getContext(half)
    hctx.imageSmoothingQuality = "high"
    hctx.drawImage(cur, cx, cy, cw, ch, 0, 0, half.width, half.height)
    cur = half
    cx = cy = 0
    cw = half.width
    ch = half.height
  }
  const out = createCanvas(w, h)
  const ctx = getContext(out)
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(cur, cx, cy, cw, ch, 0, 0, w, h)
  return out
}

export function createCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h)
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return c
}

export function getContext(canvas: AnyCanvas): Ctx {
  const ctx = (canvas as OffscreenCanvas).getContext("2d") as Ctx | null
  if (!ctx) throw new AppError("canvas")
  return ctx
}

export function encode(canvas: AnyCanvas, type: OutputFormat, quality?: number): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new AppError("encode"))),
      type,
      quality
    )
  )
}

/** An image as a JPEG (white behind any transparency) plus its pixel size, for putting into a PDF. */
export async function imageToJpeg(file: Blob): Promise<{ jpeg: Blob; w: number; h: number }> {
  const canvas = await decode(file)
  return { jpeg: await encode(canvas, "image/jpeg", 0.88), w: canvas.width, h: canvas.height }
}

/** KB as file managers show it (1 KB = 1024 bytes). */
export function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}
