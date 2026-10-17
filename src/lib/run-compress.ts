import { compressImage, type CompressOptions, type CompressResult } from "./compress"
import { AppError, type ErrorCode } from "./errors"

type WorkerResponse =
  | { id: number; ok: true; result: CompressResult }
  | { id: number; ok: false; code: ErrorCode; params?: Record<string, string | number> }

let worker: Worker | null = null
let workerBroken = false
let nextId = 0
const pending = new Map<
  number,
  { resolve: (r: CompressResult) => void; reject: (e: Error) => void; file: Blob; opts: CompressOptions }
>()

function getWorker(): Worker | null {
  if (workerBroken) return null
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null
  if (worker) return worker
  try {
    worker = new Worker(new URL("./compress.worker.ts", import.meta.url), { type: "module" })
  } catch {
    workerBroken = true
    return null
  }
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const job = pending.get(e.data.id)
    if (!job) return
    pending.delete(e.data.id)
    if (e.data.ok) job.resolve(e.data.result)
    // An unexpected worker-side failure gets one retry on the main thread.
    else if (e.data.code !== "unknown") job.reject(new AppError(e.data.code, e.data.params))
    else compressImage(job.file, job.opts).then(job.resolve, job.reject)
  }
  worker.onerror = () => {
    // The worker itself failed to load or crashed: finish everything on the main thread.
    workerBroken = true
    worker?.terminate()
    worker = null
    for (const [id, job] of pending) {
      pending.delete(id)
      compressImage(job.file, job.opts).then(job.resolve, job.reject)
    }
  }
  return worker
}

/** Compress off the main thread when the browser allows it. */
export function runCompress(file: Blob, opts: CompressOptions): Promise<CompressResult> {
  const w = getWorker()
  if (!w) return compressImage(file, opts)
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, file, opts })
    w.postMessage({ id, file, opts })
  })
}
