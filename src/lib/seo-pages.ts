// Keyword landing pages: one page per popular size, e.g. "resize image to
// 50 KB". Each opens the right tool with that limit already filled in, and has
// its own title, heading and intro (messages → seo.landing.*), so it can rank
// for that exact search in every language.

import type { ImageKind } from "./compress"
import type { ToolId } from "./file-library"

export type LandingKind = "image" | "signature" | "pdf"

export interface LandingPage {
  /** URL path without language prefix, e.g. "/resize-image-to-50kb". */
  href: string
  kind: LandingKind
  tool: ToolId
  /** Kind to preselect in the photo tool. */
  imageKind?: ImageKind
  maxKB: number
}

/** "50 KB" or "1 MB". */
export function sizeLabel(kb: number): string {
  return kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`
}

function slugSize(kb: number): string {
  return kb >= 1000 ? `${kb / 1000}mb` : `${kb}kb`
}

const IMAGE_SIZES = [10, 20, 30, 40, 50, 100, 150, 200, 300, 500, 1000]
const SIGNATURE_SIZES = [10, 20, 30, 50]
const PDF_SIZES = [100, 200, 300, 500, 1000, 2000]

export const LANDING_PAGES: LandingPage[] = [
  ...IMAGE_SIZES.map((kb) => ({
    href: `/resize-image-to-${slugSize(kb)}`,
    kind: "image" as const,
    tool: "image" as const,
    imageKind: "photo" as const,
    maxKB: kb,
  })),
  ...SIGNATURE_SIZES.map((kb) => ({
    href: `/resize-signature-to-${slugSize(kb)}`,
    kind: "signature" as const,
    tool: "image" as const,
    imageKind: "signature" as const,
    maxKB: kb,
  })),
  ...PDF_SIZES.map((kb) => ({
    href: `/compress-pdf-to-${slugSize(kb)}`,
    kind: "pdf" as const,
    tool: "pdf" as const,
    maxKB: kb,
  })),
]
