export interface Preset {
  /** Stable key; the same id means the same limit for photo and signature. */
  id: string
  maxKB: number
  minKB?: number
  width?: number
  height?: number
}

/** Quick-fill size limits, shown as chips under the Max size field. */
export const PRESETS: Preset[] = [20, 50, 100, 200, 500, 1000].map((maxKB) => ({
  id: `under-${maxKB}`,
  maxKB,
}))
