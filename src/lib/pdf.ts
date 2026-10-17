// Client-only PDF tools. pdf.js renders pages, pdf-lib writes new PDFs.
// Both are loaded on demand so the image tool doesn't pay for them.

import { AppError } from "./errors"

type PdfJs = typeof import("pdfjs-dist")
type PdfDoc = Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>

/** Thrown when a newer request replaced this one; callers ignore it. */
export class Cancelled extends Error {}

export interface Hooks {
  onProgress?: (page: number, total: number) => void
  /** Return true to stop work early (a newer request superseded this one). */
  isStale?: () => boolean
}

let pdfjsPromise: Promise<PdfJs> | null = null

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    // Served from our own origin (copied by scripts/copy-pdfjs.mjs).
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"
    return pdfjs
  })
  return pdfjsPromise
}

export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name)
}

export async function openPdf(file: Blob): Promise<PdfDoc> {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  try {
    const task = pdfjs.getDocument({
      data,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      wasmUrl: "/pdfjs/wasm/",
    })
    return await task.promise
  } catch (err) {
    if (err instanceof pdfjs.PasswordException) throw new AppError("pdfEncrypted")
    throw new AppError("pdfBroken")
  }
}

export async function countPdfPages(file: Blob): Promise<number> {
  const { PDFDocument } = await import("pdf-lib")
  try {
    const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false })
    return doc.getPageCount()
  } catch (err) {
    throw pdfLibError(err)
  }
}

// ---------------------------------------------------------------------------
// Compress: re-render every page as a JPEG at a lower resolution.

export type PdfQuality = "high" | "balanced" | "small"

/** From best to smallest. Each quality preset starts at its own step. */
const STEPS = [
  { dpi: 150, q: 0.82 },
  { dpi: 150, q: 0.7 },
  { dpi: 120, q: 0.7 },
  { dpi: 120, q: 0.6 },
  { dpi: 100, q: 0.55 },
  { dpi: 96, q: 0.5 },
  { dpi: 80, q: 0.45 },
  { dpi: 72, q: 0.4 },
  { dpi: 60, q: 0.35 },
  { dpi: 50, q: 0.3 },
]
const START: Record<PdfQuality, number> = { high: 0, balanced: 2, small: 5 }

export interface PdfResult {
  blob: Blob
  pages: number
  /** The original was already smaller, so it is returned as-is. */
  unchanged: boolean
}

export async function compressPdf(
  file: File,
  opts: { quality: PdfQuality; maxBytes?: number },
  hooks: Hooks = {}
): Promise<PdfResult> {
  const doc = await openPdf(file)
  try {
    const total = doc.numPages
    let renderedDpi = 0
    let pages: RenderedPage[] = []

    for (let i = START[opts.quality]; i < STEPS.length; i++) {
      const { dpi, q } = STEPS[i]
      if (renderedDpi !== dpi) {
        pages = await renderPages(doc, dpi, hooks)
        renderedDpi = dpi
      }

      const jpegs = await Promise.all(pages.map((p) => toJpeg(p.canvas, q)))
      if (hooks.isStale?.()) throw new Cancelled()
      const estimate = jpegs.reduce((sum, b) => sum + b.size, 0) + total * 600
      // With no size limit the chosen quality is final; otherwise keep stepping down.
      if (opts.maxBytes && estimate > opts.maxBytes && i < STEPS.length - 1) continue

      const blob = await imagesToPdf(
        jpegs.map((jpeg, n) => ({ jpeg, w: pages[n].w, h: pages[n].h }))
      )
      if (opts.maxBytes && blob.size > opts.maxBytes) continue

      if (file.size <= blob.size && (!opts.maxBytes || file.size <= opts.maxBytes)) {
        return { blob: file, pages: total, unchanged: true }
      }
      return { blob, pages: total, unchanged: false }
    }
    if (opts.maxBytes && file.size <= opts.maxBytes) return { blob: file, pages: total, unchanged: true }
    throw new AppError("pdfTooBig")
  } finally {
    void doc.loadingTask.destroy()
  }
}

type RenderedPage = { canvas: HTMLCanvasElement; w: number; h: number }

async function renderPages(doc: PdfDoc, dpi: number, hooks: Hooks): Promise<RenderedPage[]> {
  const pages: RenderedPage[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    if (hooks.isStale?.()) throw new Cancelled()
    hooks.onProgress?.(n, doc.numPages)
    const page = await doc.getPage(n)
    const size = page.getViewport({ scale: 1 }) // PDF points, rotation applied
    const viewport = page.getViewport({ scale: dpi / 72 })
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // "print" renders without requestAnimationFrame, so it keeps going in a
    // background tab, and it bakes filled-in form fields into the page.
    await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" }).promise
    page.cleanup()
    pages.push({ canvas, w: size.width, h: size.height })
  }
  return pages
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AppError("encode"))), "image/jpeg", quality)
  )
}

// ---------------------------------------------------------------------------
// Writing PDFs

/** A4 in PDF points (1 pt = 1/72 inch). */
export const A4 = { w: 595.28, h: 841.89 }
export const MM = 72 / 25.4

/** One page per JPEG, each filling a page of the given size in points. */
export async function imagesToPdf(pages: { jpeg: Blob; w: number; h: number }[]): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib")
  const out = await PDFDocument.create()
  for (const { jpeg, w, h } of pages) {
    const img = await out.embedJpg(await jpeg.arrayBuffer())
    out.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h })
  }
  return pdfBlob(await out.save())
}

export type MergeItem = { file: File; kind: "pdf" | "image" }

/**
 * Join PDFs and images into one PDF. With `a4`, every page is scaled to fit an
 * A4 sheet (portrait or landscape to match the content).
 */
export async function mergeToPdf(
  items: MergeItem[],
  opts: { a4: boolean; imageToJpeg: (file: File) => Promise<{ jpeg: Blob; w: number; h: number }> }
): Promise<{ blob: Blob; pages: number }> {
  const { PDFDocument } = await import("pdf-lib")
  const out = await PDFDocument.create()

  for (const item of items) {
    if (item.kind === "pdf") {
      let src: Awaited<ReturnType<typeof PDFDocument.load>>
      try {
        src = await PDFDocument.load(await item.file.arrayBuffer(), { updateMetadata: false })
      } catch (err) {
        throw pdfLibError(err)
      }
      if (!opts.a4) {
        for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page)
        continue
      }
      const embedded = await out.embedPages(src.getPages())
      for (const page of embedded) {
        const a4 = out.addPage(a4For(page.width, page.height))
        a4.drawPage(page, fitBox(a4, page.width, page.height, 0))
      }
    } else {
      const { jpeg, w, h } = await opts.imageToJpeg(item.file)
      const img = await out.embedJpg(await jpeg.arrayBuffer())
      if (!opts.a4) {
        // 150 dpi keeps a phone photo near A4-ish physical size.
        const pw = (w * 72) / 150
        const ph = (h * 72) / 150
        out.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph })
        continue
      }
      const a4 = out.addPage(a4For(w, h))
      a4.drawImage(img, fitBox(a4, w, h, 10 * MM))
    }
  }
  return { blob: pdfBlob(await out.save()), pages: out.getPageCount() }
}

function a4For(w: number, h: number): [number, number] {
  return w > h ? [A4.h, A4.w] : [A4.w, A4.h]
}

/** Box that fits w×h inside the page minus a margin, centred. */
function fitBox(page: import("pdf-lib").PDFPage, w: number, h: number, margin: number) {
  const pw = page.getWidth()
  const ph = page.getHeight()
  const scale = Math.min((pw - 2 * margin) / w, (ph - 2 * margin) / h)
  const width = w * scale
  const height = h * scale
  return { x: (pw - width) / 2, y: (ph - height) / 2, width, height }
}

function pdfLibError(err: unknown): AppError {
  return new AppError(
    err instanceof Error && /encrypt/i.test(err.message) ? "pdfEncrypted" : "pdfBroken"
  )
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" })
}
