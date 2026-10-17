import { compressImage, type CompressOptions } from "./compress"
import { toAppError } from "./errors"

export interface WorkerRequest {
  id: number
  file: Blob
  opts: CompressOptions
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, file, opts } = e.data
  try {
    const result = await compressImage(file, opts)
    self.postMessage({ id, ok: true, result })
  } catch (err) {
    const { code, params } = toAppError(err)
    self.postMessage({ id, ok: false, code, params })
  }
}
