// Lays out the front and back of an ID card (Aadhaar, PAN, …) on one A4 page.

import { bestUnderLimit, createCanvas, encode, getContext, type AnyCanvas } from "./compress"
import { AppError } from "./errors"
import { A4, imagesToPdf } from "./pdf"

export type CardSize = "actual" | "large"
export type SheetFormat = "pdf" | "jpg" | "png"

/** ISO/IEC 7810 ID-1, the size of Aadhaar, PAN, debit cards: 85.6 × 53.98 mm. */
const CARD_RATIO = 85.6 / 53.98
const CARD_WIDTH_MM: Record<CardSize, number> = { actual: 85.6, large: 150 }
const TOP_MM: Record<CardSize, number> = { actual: 25, large: 18 }
const GAP_MM = 12
const A4_MM = { w: 210, h: 297 }

/** Print-friendly first, then smaller if a size limit demands it. */
const DPIS = [150, 120, 100, 80, 60]

/** Turn a card photo by quarter turns clockwise. */
export function rotateQuarter(src: AnyCanvas, turns: number): AnyCanvas {
  const t = ((turns % 4) + 4) % 4
  if (t === 0) return src
  const swap = t % 2 === 1
  const out = createCanvas(swap ? src.height : src.width, swap ? src.width : src.height)
  const ctx = getContext(out)
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((t * Math.PI) / 2)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

/** Render the A4 sheet with each card centred in its own card-sized box. */
export function drawSheet(cards: AnyCanvas[], size: CardSize, dpi: number): AnyCanvas {
  const px = dpi / 25.4
  const sheet = createCanvas(Math.round(A4_MM.w * px), Math.round(A4_MM.h * px))
  const ctx = getContext(sheet)
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  ctx.imageSmoothingQuality = "high"

  const boxW = CARD_WIDTH_MM[size] * px
  const boxH = boxW / CARD_RATIO
  let y = TOP_MM[size] * px
  for (const card of cards) {
    // Contain, never crop: nothing printed on the card may be cut off.
    const scale = Math.min(boxW / card.width, boxH / card.height)
    const w = card.width * scale
    const h = card.height * scale
    const x = (sheet.width - w) / 2
    const top = y + (boxH - h) / 2
    ctx.drawImage(card, x, top, w, h)
    // Thin grey outline to cut along after printing.
    ctx.strokeStyle = "#b5b5b5"
    ctx.lineWidth = Math.max(1, dpi / 150)
    ctx.strokeRect(x, top, w, h)
    y += boxH + GAP_MM * px
  }
  return sheet
}

export async function makeIdSheet(
  cards: AnyCanvas[],
  opts: { size: CardSize; format: SheetFormat; maxBytes?: number }
): Promise<{ blob: Blob; preview: Blob }> {
  if (cards.length === 0) throw new AppError("noCards")
  // Leave room for the PDF wrapper around the page image.
  const overhead = opts.format === "pdf" ? 2000 : 0
  const limit = opts.maxBytes ? opts.maxBytes - overhead : Number.POSITIVE_INFINITY

  for (const dpi of DPIS) {
    if (opts.format === "png") {
      // PNG is lossless: only the resolution can shrink it.
      const png = await encode(drawSheet(cards, opts.size, dpi), "image/png")
      if (!opts.maxBytes || png.size <= opts.maxBytes) return { blob: png, preview: png }
      continue
    }
    const last = dpi === DPIS[DPIS.length - 1]
    const sheet = drawSheet(cards, opts.size, dpi)
    const jpeg = await bestUnderLimit(sheet, "image/jpeg", limit, last ? 0.2 : 0.55)
    if (!jpeg) continue
    if (opts.format === "jpg") return { blob: jpeg.blob, preview: jpeg.blob }
    const pdf = await imagesToPdf([{ jpeg: jpeg.blob, w: A4.w, h: A4.h }])
    if (!opts.maxBytes || pdf.size <= opts.maxBytes) return { blob: pdf, preview: jpeg.blob }
  }
  throw new AppError(opts.format === "png" ? "tooBigPng" : "tooBig")
}
