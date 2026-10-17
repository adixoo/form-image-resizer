import type { ImageKind, OutputFormat } from "@/lib/compress"

export interface Settings {
  kind: ImageKind
  maxKB: string
  minKB: string
  width: string
  height: string
  format: OutputFormat
  cleanSignature: boolean
  cleanDocument: boolean
}

export const INITIAL_SETTINGS: Settings = {
  kind: "photo",
  maxKB: "",
  minKB: "",
  width: "",
  height: "",
  format: "image/jpeg",
  cleanSignature: true,
  cleanDocument: false,
}

/** Values are keys under image.validation.* */
export type SettingErrors = Partial<
  Record<"maxKB" | "minKB" | "dims", "maxMin" | "maxHuge" | "minInvalid" | "minOverMax" | "dimsBoth" | "dimsMin">
>

export function validate(s: Settings): SettingErrors {
  const errors: SettingErrors = {}
  const max = Number(s.maxKB)
  if (s.maxKB !== "" && (!Number.isFinite(max) || max < 1)) errors.maxKB = "maxMin"
  else if (max > 10_000) errors.maxKB = "maxHuge"
  if (s.minKB !== "") {
    const min = Number(s.minKB)
    if (!Number.isFinite(min) || min <= 0) errors.minKB = "minInvalid"
    else if (s.maxKB !== "" && min * 1024 >= max * 1000) errors.minKB = "minOverMax"
  }
  if ((s.width === "") !== (s.height === "")) errors.dims = "dimsBoth"
  else if (s.width !== "" && (Number(s.width) < 10 || Number(s.height) < 10)) errors.dims = "dimsMin"
  return errors
}

/** Ready to resize: a max size is entered and nothing is invalid. */
export function isReady(s: Settings): boolean {
  return s.maxKB !== "" && Object.keys(validate(s)).length === 0
}

/** Short labels for advanced options that differ from the defaults. */
export function advancedSummary(s: Settings): string[] {
  const out: string[] = []
  if (s.minKB) out.push(`min ${s.minKB} KB`)
  if (s.width && s.height) out.push(`${s.width}×${s.height}`)
  if (s.kind === "signature" && !s.cleanSignature) out.push("no cleanup")
  if (s.kind === "document" && s.cleanDocument) out.push("black & white")
  return out
}

export function digits(v: string) {
  return v.replace(/\D/g, "").slice(0, 4)
}

export function decimal(v: string) {
  return v.replace(/[^\d.]/g, "")
}
