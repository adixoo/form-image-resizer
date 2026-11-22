import { useRef, useState } from "react"
import { X } from "lucide-react"
import { useTranslations } from "use-intl"

import { useCurrentTool } from "@/components/shared/tool-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ErrorAlert } from "@/components/shared/error-alert"
import { ResultCard, ResultSkeleton } from "@/components/shared/result-card"
import { ToolCard, ToolStatus } from "@/components/shared/tool-card"
import { formatKB, imageToJpeg } from "@/lib/compress"
import { AppError, toAppError } from "@/lib/errors"
import { fileKind, useIncomingFile, useReportInUse } from "@/lib/file-library"
import { mergeToPdf } from "@/lib/pdf"
import { cn } from "@/lib/utils"

interface Result {
  url: string
  blob: Blob
}

/** One image in, a one-page PDF out. Converts as soon as an image arrives or A4 changes. */
export function ImageToPdfApp() {
  const t = useTranslations("toPdf")
  const tc = useTranslations("common")
  const [file, setFile] = useState<File | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const [a4, setA4] = useState(true)
  const [result, setResult] = useState<Result | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const runId = useRef(0)
  const resultUrl = useRef<string | null>(null)

  function replaceResult(next: Result | null) {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = next?.url ?? null
    setResult(next)
  }

  async function convert(src: File | null, toA4: boolean) {
    const id = ++runId.current
    replaceResult(null)
    setError(null)
    setWorking(!!src)
    if (!src) return
    try {
      const out = await mergeToPdf([{ file: src, kind: "image" }], { a4: toA4, imageToJpeg })
      if (id !== runId.current) return
      replaceResult({ url: URL.createObjectURL(out.blob), blob: out.blob })
    } catch (err) {
      if (id !== runId.current) return
      setError(toAppError(err))
    }
    setWorking(false)
  }

  function setSource(next: File | null) {
    if (thumb) URL.revokeObjectURL(thumb)
    setThumb(next ? URL.createObjectURL(next) : null)
    setFile(next)
    void convert(next, a4)
  }

  // Files arrive from the shared files bar; a new image replaces the old one.
  useIncomingFile("toPdf", (next) => {
    if (next === file) return
    if (fileKind(next) !== "image") {
      setSource(null)
      setError(new AppError("notImage"))
      return
    }
    setSource(next)
  })
  useReportInUse(file ? [file] : [], useCurrentTool() === "toPdf")

  const name = file?.name.replace(/\.[^.]+$/, "") || "image"

  return (
    <div className="flex flex-col gap-6">
      <ToolCard
        footer={
          <ToolStatus state={working ? "working" : result ? "done" : "idle"}>
            {!file ? t("noFile") : working ? tc("working") : result ? t("done") : null}
          </ToolStatus>
        }
      >
        {file && thumb && (
          <div className="flex items-center gap-4">
            <img
              src={thumb}
              alt=""
              className="size-12 shrink-0 rounded-lg border border-hairline bg-surface-soft object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate type-body-sm-strong text-ink">{file.name}</p>
              <p className="type-body-sm tabular-nums text-body">{formatKB(file.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSource(null)}
              aria-label={tc("remove")}
              title={tc("remove")}
            >
              <X />
            </Button>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Switch
            id="toPdfA4"
            checked={a4}
            onCheckedChange={(v) => {
              setA4(v)
              void convert(file, v)
            }}
            className="mt-0.5"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="toPdfA4">{t("a4")}</Label>
            <p className="type-body-sm text-body">{t("a4Hint")}</p>
          </div>
        </div>
      </ToolCard>

      <ErrorAlert error={error} />

      {!result && working && <ResultSkeleton label={tc("working")} previews={1} />}

      {result && thumb && (
        <ResultCard
          split
          title={tc("readyTitle")}
          description={t("resultBody", { size: formatKB(result.blob.size) })}
          download={{ url: result.url, blob: result.blob, fileName: `${name}.pdf`, format: tc("pdf") }}
        >
          <PagePreview url={thumb} a4={a4} />
        </ResultCard>
      )}
    </div>
  )
}

/**
 * The PDF page as mergeToPdf lays it out: with A4, the image fitted and centred
 * on an A4 sheet (landscape for wide images) inside a 10 mm margin; without, the
 * page is the image itself.
 */
function PagePreview({ url, a4 }: { url: string; a4: boolean }) {
  const [landscape, setLandscape] = useState(false)
  const img = (
    <img
      src={url}
      alt=""
      onLoad={(e) => setLandscape(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight)}
      className={cn("object-contain", a4 ? "size-full" : "max-h-96 max-w-full rounded-sm")}
    />
  )
  return (
    <div className="flex justify-center">
      {a4 ? (
        <div
          className={cn(
            "relative max-w-full rounded-sm bg-white",
            landscape ? "aspect-[297/210] w-full md:max-w-md" : "aspect-[210/297] h-96"
          )}
        >
          {/* 10 mm of 210 mm / 297 mm, as insets of the page box. */}
          <div className={cn("absolute", landscape ? "inset-x-[3.37%] inset-y-[4.76%]" : "inset-x-[4.76%] inset-y-[3.37%]")}>
            {img}
          </div>
        </div>
      ) : (
        img
      )}
    </div>
  )
}
