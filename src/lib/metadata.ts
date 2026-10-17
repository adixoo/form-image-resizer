// Lossless metadata removal: drops the blocks that can carry location, camera
// and other personal details, leaving the image data byte-for-byte untouched.
// Returns null when the file can't be safely kept as is (wrong format, broken
// structure, or a rotation flag that would be lost).

const JPEG_DROP = new Set([
  0xe1, // APP1: Exif (GPS, camera, date) and XMP
  0xed, // APP13: Photoshop / IPTC
  0xfe, // COM: free-text comment
])

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  const keep: Uint8Array[] = [bytes.subarray(0, 2)]
  let i = 2
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null
    const marker = bytes[i + 1]
    // Start of scan: the rest is compressed image data, copy it unchanged.
    if (marker === 0xda) {
      keep.push(bytes.subarray(i))
      return concat(keep)
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3]
    const end = i + 2 + length
    if (length < 2 || end > bytes.length) return null
    if (marker === 0xe1 && exifOrientation(bytes.subarray(i + 4, end)) > 1) return null
    if (!JPEG_DROP.has(marker)) keep.push(bytes.subarray(i, end))
    i = end
  }
  return null
}

/** Orientation tag (0x0112) from an APP1 Exif payload; 1 when absent. */
function exifOrientation(app1: Uint8Array): number {
  // "Exif\0\0" then a TIFF header.
  if (app1.length < 14 || String.fromCharCode(...app1.subarray(0, 4)) !== "Exif") return 1
  const tiff = app1.subarray(6)
  const little = tiff[0] === 0x49 // "II"
  const u16 = (o: number) => (little ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1])
  const u32 = (o: number) =>
    little
      ? (tiff[o] | (tiff[o + 1] << 8) | (tiff[o + 2] << 16) | (tiff[o + 3] << 24)) >>> 0
      : ((tiff[o] << 24) | (tiff[o + 1] << 16) | (tiff[o + 2] << 8) | tiff[o + 3]) >>> 0
  const ifd = u32(4)
  if (ifd + 2 > tiff.length) return 1
  const count = u16(ifd)
  for (let n = 0; n < count; n++) {
    const entry = ifd + 2 + n * 12
    if (entry + 12 > tiff.length) break
    if (u16(entry) === 0x0112) return u16(entry + 8)
  }
  return 1
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
// Text and timestamp chunks can hold personal details; eXIf may also rotate.
const PNG_DROP = new Set(["tEXt", "zTXt", "iTXt", "tIME"])

export function stripPngMetadata(bytes: Uint8Array): Uint8Array | null {
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return null
  const keep: Uint8Array[] = [bytes.subarray(0, 8)]
  let i = 8
  while (i + 12 <= bytes.length) {
    const length = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8))
    const end = i + 12 + length
    if (end > bytes.length) return null
    // eXIf can set an orientation browsers apply; re-encode upright instead.
    if (type === "eXIf") return null
    if (!PNG_DROP.has(type)) keep.push(bytes.subarray(i, end))
    i = end
    if (type === "IEND") return concat(keep)
  }
  return null
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
