
import { useRef, useState } from "react"
import { FileText, X } from "lucide-react"
import { useTranslations } from "use-intl"

import { useCurrentTool } from "@/components/shared/tool-context"
import { Button } from "@/components/ui/button"
import { KBInput, Row } from "@/components/resizer/fields"
import { decimal } from "@/components/resizer/settings"
import { ErrorAlert } from "@/components/shared/error-alert"
import { ResultCard, ResultSkeleton } from "@/components/shared/result-card"
import { Segmented } from "@/components/shared/segmented"
import { ToolCard, ToolStatus } from "@/components/shared/tool-card"
import { formatKB } from "@/lib/compress"
import { AppError, toAppError } from "@/lib/errors"
import { useIncomingFile, useReportInUse } from "@/lib/file-library"
import type { Prefill } from "@/components/tools-app"
import { Cancelled, compressPdf, countPdfPages, isPdf, type PdfQuality, type PdfResult } from "@/lib/pdf"

interface Source {
  file: File
  pages: number
}

interface Options {
  quality: PdfQuality
  maxKB: string
}

const DEBOUNCE_MS = 500

export function PdfCompressApp({ prefill }: { prefill?: Prefill }) {
  const t = useTranslations("pdf")
  const tc = useTranslations("common")
  const tv = useTranslations("image.validation")
  const [source, setSource] = useState<Source | null>(null)
  const [options, setOptions] = useState<Options>({
    quality: "balanced",
    maxKB: prefill?.maxKB ? String(prefill.maxKB) : "",
  })
  const [result, setResult] = useState<(PdfResult & { url: string }) | null>(null)
  const [progress, setProgress] = useState<{ page: number; total: number } | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [loadError, setLoadError] = useState<AppError | null>(null)
  const runId = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const resultUrl = useRef<string | null>(null)

  function replaceResult(next: (PdfResult & { url: string }) | null) {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = next?.url ?? null
    setResult(next)
  }

  function schedule(src: Source | null, o: Options, delay = DEBOUNCE_MS) {
    const id = ++runId.current
    window.clearTimeout(timer.current)
    setError(null)
    const max = Number(o.maxKB)
    if (!src || (o.maxKB !== "" && !(max >= 1))) {
      setProgress(null)
      if (!src) replaceResult(null)
      return
    }
    setProgress({ page: 0, total: src.pages })
    timer.current = window.setTimeout(async () => {
      try {
        const out = await compressPdf(
          src.file,
          { quality: o.quality, maxBytes: o.maxKB ? max * 1000 : undefined },
          {
            isStale: () => id !== runId.current,
            onProgress: (page, total) => setProgress({ page, total }),
          }
        )
        if (id !== runId.current) return
        replaceResult({ ...out, url: URL.createObjectURL(out.blob) })
      } catch (err) {
        if (err instanceof Cancelled || id !== runId.current) return
        replaceResult(null)
        setError(toAppError(err))
      }
      setProgress(null)
    }, delay)
  }

  function update(patch: Partial<Options>, delay?: number) {
    const next = { ...options, ...patch }
    setOptions(next)
    schedule(source, next, delay)
  }

  /** Take the PDF out of this tool; it stays in "Your files". */
  function removeSource() {
    setSource(null)
    setLoadError(null)
    schedule(null, options)
  }

  async function handleFile(file: File) {
    if (source?.file === file) return
    setLoadError(null)
    setSource(null)
    schedule(null, options)
    if (!isPdf(file)) {
      setLoadError(new AppError("notPdf"))
      return
    }
    try {
      const next = { file, pages: await countPdfPages(file) }
      setSource(next)
      schedule(next, options, 0)
    } catch (err) {
      setLoadError(toAppError(err))
    }
  }

  // Files arrive from the shared files bar above the tool.
  useIncomingFile("pdf", handleFile)
  useReportInUse(source ? [source.file] : [], useCurrentTool() === "pdf")

  const working = progress !== null
  const maxInvalid = options.maxKB !== "" && !(Number(options.maxKB) >= 1)
  const name = source?.file.name.replace(/\.pdf$/i, "") ?? "document"
  const saved = result && source ? Math.round((1 - result.blob.size / source.file.size) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <ToolCard
        footer={
          <ToolStatus state={working ? "working" : result ? "done" : "idle"}>
            {!source
              ? t("status.noFile")
              : working
                ? t("status.working", { page: Math.max(1, progress.page), total: progress.total })
                : result
                  ? t("status.done")
                  : null}
          </ToolStatus>
        }
      >
        {source ? (
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-soft">
              <FileText className="size-6 text-ink" strokeWidth={1.5} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate type-body-sm-strong text-ink">{source.file.name}</p>
              <p className="type-body-sm tabular-nums text-body">
                {formatKB(source.file.size)} · {tc("pages", { count: source.pages })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={removeSource}
              aria-label={tc("remove")}
              title={tc("remove")}
            >
              <X />
            </Button>
          </div>
        ) : null}

        <ErrorAlert error={loadError} title={tc("couldntOpen")} />

        <div className="flex flex-col gap-4">
          <Row label={t("quality")}>
            <Segmented<PdfQuality>
              label={t("quality")}
              value={options.quality}
              options={[
                { value: "high", label: t("high") },
                { value: "balanced", label: t("balanced") },
                { value: "small", label: t("small") },
              ]}
              onChange={(quality) => update({ quality }, 0)}
            />
          </Row>
          <Row
            label={tc("maxSizeOptional")}
            htmlFor="pdfMaxKB"
            error={maxInvalid ? tv("maxMin") : undefined}
          >
            <KBInput
              id="pdfMaxKB"
              className="sm:max-w-48"
              placeholder={tc("optional")}
              value={options.maxKB}
              invalid={maxInvalid}
              onChange={(v) => update({ maxKB: decimal(v) })}
            />
          </Row>
        </div>
      </ToolCard>

      <ErrorAlert error={error} />

      {!result && working && source && <ResultSkeleton label={tc("working")} previews={0} />}

      {result && source && (
        <ResultCard
          busy={working}
          title={tc("readyTitle")}
          description={
            result.unchanged
              ? t("unchanged")
              : t("resultBody", {
                  from: formatKB(source.file.size),
                  to: formatKB(result.blob.size),
                  percent: saved,
                })
          }
          download={{
            url: result.url,
            blob: result.blob,
            fileName: `${name}_${Math.max(1, Math.floor(result.blob.size / 1024))}kb.pdf`,
            format: tc("pdf"),
          }}
        >
          {!result.unchanged && <p className="type-body-sm text-on-dark-mute">{t("note")}</p>}
        </ResultCard>
      )}
    </div>
  )
}
