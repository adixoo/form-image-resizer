// "Your files": every image or PDF the user adds (or saves from a result) in
// this tab, shared by all tools so nobody has to pick the same file twice.
//
// Kept in memory only, never in browser storage: these are ID cards and
// certificates, often on shared or cyber-café computers, so they disappear
// when the tab is closed or reloaded.

import { useEffect, useRef, useSyncExternalStore } from "react"

export type FileKind = "image" | "pdf"

export interface LibraryFile {
  id: number
  file: File
  kind: FileKind
  /** Object URL: image thumbnail and download link. */
  url: string
  /** "result" = made by one of the tools and saved by the user. */
  source: "upload" | "result"
}

let items: LibraryFile[] = []
let nextId = 1
const listeners = new Set<() => void>()
const EMPTY: LibraryFile[] = []

function emit() {
  listeners.forEach((l) => l())
}

export function fileKind(file: File): FileKind | null {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf"
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    return "image"
  }
  return null
}

function same(a: File, b: File) {
  return a === b || (a.name === b.name && a.size === b.size && a.lastModified === b.lastModified)
}

/**
 * Add files (newest first). Duplicates and unsupported types are skipped.
 * Returns the library entries for the given files, including ones already there.
 */
export function addToLibrary(
  files: File[],
  source: LibraryFile["source"] = "upload"
): LibraryFile[] {
  const added: LibraryFile[] = []
  const result: LibraryFile[] = []
  for (const file of files) {
    const kind = fileKind(file)
    if (!kind) continue
    const existing = items.find((x) => same(x.file, file)) ?? added.find((x) => same(x.file, file))
    if (existing) {
      result.push(existing)
      continue
    }
    added.push({
      id: nextId++,
      file,
      kind,
      url: URL.createObjectURL(file),
      source,
    })
    result.push(added[added.length - 1])
  }
  if (added.length > 0) {
    items = [...[...added].reverse(), ...items]
    emit()
  }
  return result
}

export function isInLibrary(file: File) {
  return items.some((x) => same(x.file, file))
}

export function removeFromLibrary(id: number) {
  const item = items.find((x) => x.id === id)
  if (item) URL.revokeObjectURL(item.url)
  items = items.filter((x) => x.id !== id)
  emit()
}

export function clearLibrary() {
  items.forEach((x) => URL.revokeObjectURL(x.url))
  items = []
  emit()
}

/** Live list of library files; empty during server rendering. */
export function useLibrary(): LibraryFile[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => items,
    () => EMPTY
  )
}

// ---------------------------------------------------------------------------
// The files bar hands files to whichever tool is on screen, and each tool
// reports back which files it is using so the bar can mark them.

export type ToolId = "image" | "pdf" | "idCard" | "merge"

let queue: { tool: ToolId; file: File }[] = []
const queueListeners = new Set<() => void>()

/** Deliver a file to a tool (immediately if it is mounted, else once it mounts). */
export function sendToTool(tool: ToolId, file: File) {
  queue.push({ tool, file })
  queueListeners.forEach((l) => l())
}

/** Call `onFile` for every file sent to this tool. */
export function useIncomingFile(tool: ToolId, onFile: (file: File) => void) {
  const latest = useRef(onFile)
  useEffect(() => {
    latest.current = onFile
  })
  useEffect(() => {
    const deliver = () => {
      const mine = queue.filter((x) => x.tool === tool)
      if (mine.length === 0) return
      queue = queue.filter((x) => x.tool !== tool)
      mine.forEach((x) => latest.current(x.file))
    }
    deliver()
    queueListeners.add(deliver)
    return () => {
      queueListeners.delete(deliver)
    }
  }, [tool])
}

let inUse: File[] = []
const inUseListeners = new Set<() => void>()

/** Tools call this with the files they are currently using. */
export function useReportInUse(files: File[], active = true) {
  useEffect(() => {
    // All tools stay mounted on the page; only the visible one reports.
    if (!active) return
    if (files.length !== inUse.length || files.some((f, i) => f !== inUse[i])) {
      inUse = files
      inUseListeners.forEach((l) => l())
    }
  })
  useEffect(
    () => () => {
      inUse = []
      inUseListeners.forEach((l) => l())
    },
    []
  )
}

export function useInUse(): File[] {
  return useSyncExternalStore(
    (listener) => {
      inUseListeners.add(listener)
      return () => inUseListeners.delete(listener)
    },
    () => inUse,
    () => EMPTY_FILES
  )
}

const EMPTY_FILES: File[] = []
