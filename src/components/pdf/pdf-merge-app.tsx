
import { useLayoutEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, FileText, Image as ImageIcon, X } from "lucide-react"
import { useTranslations } from "use-intl"

import { useCurrentTool } from "@/components/shared/tool-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ErrorAlert } from "@/components/shared/error-alert"
import { ResultCard, ResultSkeleton } from "@/components/shared/result-card"
import { ToolCard, ToolStatus } from "@/components/shared/tool-card"
import { decode, encode, formatKB } from "@/lib/compress"
import { AppError, toAppError } from "@/lib/errors"
import { fileKind, useIncomingFile, useReportInUse } from "@/lib/file-library"
import { motion, reducedMotion, type FlipState } from "@/lib/motion"
import { countPdfPages, mergeToPdf } from "@/lib/pdf"

interface Item {
  id: number
  file: File
  kind: "pdf" | "image"
  pages: number
}

interface Merged {
  url: string
  blob: Blob
  size: number
  pages: number
}

let nextId = 0

async function imageToJpeg(file: File) {
  const canvas = await decode(file)
  return { jpeg: await encode(canvas, "image/jpeg", 0.88), w: canvas.width, h: canvas.height }
}

export function PdfMergeApp() {
  const t = useTranslations("merge")
  const tc = useTranslations("common")
  const [items, setItems] = useState<Item[]>([])
  const [a4, setA4] = useState(true)
  const [merged, setMerged] = useState<Merged | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const mergedUrl = useRef<string | null>(null)

  function replaceMerged(next: Merged | null) {
    if (mergedUrl.current) URL.revokeObjectURL(mergedUrl.current)
    mergedUrl.current = next?.url ?? null
    setMerged(next)
  }

  function changeItems(next: Item[]) {
    setItems(next)
    replaceMerged(null)
    setError(null)
  }

  async function addFiles(files: File[]) {
    setError(null)
    const added: Item[] = []
    for (const file of files) {
      try {
        const kind = fileKind(file)
        if (kind === "pdf") {
          added.push({ id: nextId++, file, kind, pages: await countPdfPages(file) })
        } else if (kind === "image") {
          added.push({ id: nextId++, file, kind, pages: 1 })
        } else {
          setError(new AppError("notPdf"))
        }
      } catch (err) {
        setError(toAppError(err))
      }
    }
    setItems((prev) => [...prev, ...added])
    replaceMerged(null)
  }

  // Files arrive from the shared files bar. Tapping a file that is already in
  // the list takes it out again.
  useIncomingFile("merge", (file) => {
    const existing = items.find((x) => x.file === file)
    if (existing) changeItems(items.filter((x) => x !== existing))
    else addFiles([file])
  })
  useReportInUse(items.map((x) => x.file), useCurrentTool() === "merge")

  // Reordering: record where rows are, re-render, then animate them from the
  // old spots to the new ones (FLIP) so the moved file is easy to follow.
  const listRef = useRef<HTMLOListElement>(null)
  const flipState = useRef<FlipState | null>(null)
  useLayoutEffect(() => {
    const state = flipState.current
    flipState.current = null
    if (state) motion()?.Flip.from(state, { duration: 0.35, ease: "power2.inOut" })
  }, [items])

  function move(index: number, by: -1 | 1) {
    const Flip = motion()?.Flip
    if (Flip && listRef.current && !reducedMotion()) {
      flipState.current = Flip.getState(listRef.current.querySelectorAll("[data-flip-id]"))
    }
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    changeItems(next)
  }

  async function merge() {
    setWorking(true)
    setError(null)
    try {
      const out = await mergeToPdf(items, { a4, imageToJpeg })
      replaceMerged({ url: URL.createObjectURL(out.blob), blob: out.blob, size: out.blob.size, pages: out.pages })
    } catch (err) {
      setError(toAppError(err))
    }
    setWorking(false)
  }

  const totalPages = items.reduce((n, x) => n + x.pages, 0)

  return (
    <div className="flex flex-col gap-6">
      <ToolCard
        footer={
          <>
            <ToolStatus state={working ? "working" : merged ? "done" : "idle"}>
              {items.length < 2 ? t("needTwo") : tc("pages", { count: totalPages })}
            </ToolStatus>
            <Button className="w-full sm:w-auto" disabled={items.length < 2 || working} onClick={merge}>
              {working ? tc("working") : t("merge", { count: items.length })}
            </Button>
          </>
        }
      >
        {items.length > 0 && (
          <div className="flex flex-col gap-3">
            <ol ref={listRef} className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline">
              {items.map((item, i) => (
                <li
                  key={item.id}
                  data-flip-id={item.id}
                  className="flex items-center gap-3 bg-canvas py-2 pr-2 pl-4 first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="w-5 shrink-0 type-body-sm tabular-nums text-mute">{i + 1}</span>
                  {item.kind === "pdf" ? (
                    <FileText className="size-4 shrink-0 text-ink" strokeWidth={1.75} />
                  ) : (
                    <ImageIcon className="size-4 shrink-0 text-ink" strokeWidth={1.75} />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate type-body-sm-strong text-ink">{item.file.name}</span>
                    <span className="type-body-sm tabular-nums text-body">
                      {formatKB(item.file.size)} ·{" "}
                      {item.kind === "pdf" ? tc("pages", { count: item.pages }) : t("image")}
                    </span>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      aria-label={tc("moveUp")}
                      title={tc("moveUp")}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={i === items.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label={tc("moveDown")}
                      title={tc("moveDown")}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => changeItems(items.filter((x) => x.id !== item.id))}
                      aria-label={tc("remove")}
                      title={tc("remove")}
                    >
                      <X />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            <p className="type-caption-sm text-mute">{t("pickMore")}</p>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Switch
            id="a4"
            checked={a4}
            onCheckedChange={(v) => {
              setA4(v)
              replaceMerged(null)
            }}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="a4">{t("a4")}</Label>
            <p className="type-body-sm text-body">{t("a4Hint")}</p>
          </div>
        </div>

      </ToolCard>

      <ErrorAlert error={error} />

      {!merged && working && <ResultSkeleton label={tc("working")} previews={0} />}

      {merged && (
        <ResultCard
          title={tc("readyTitle")}
          description={t("resultBody", {
            pages: tc("pages", { count: merged.pages }),
            size: formatKB(merged.size),
          })}
          download={{
            url: merged.url,
            blob: merged.blob,
            fileName: `merged_${items.length}-files.pdf`,
            format: tc("pdf"),
          }}
        />
      )}
    </div>
  )
}
