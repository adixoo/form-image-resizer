
import { useRef, useState } from "react"
import { FileText, PenLine, UserRound, X } from "lucide-react"
import { useTranslations } from "use-intl"

import { useCurrentTool } from "@/components/shared/tool-context"
import { Button } from "@/components/ui/button"
import { AdvancedSheet } from "@/components/resizer/advanced-sheet"
import { PresetPicker } from "@/components/resizer/preset-picker"
import { KBInput, Row } from "@/components/resizer/fields"
import { ResultPanel, type ResizedImage } from "@/components/resizer/result-panel"
import { ResultSkeleton } from "@/components/shared/result-card"
import {
  decimal,
  INITIAL_SETTINGS,
  isReady,
  validate,
  type Settings,
} from "@/components/resizer/settings"
import { ErrorAlert } from "@/components/shared/error-alert"
import { Segmented } from "@/components/shared/segmented"
import { ToolCard, ToolStatus } from "@/components/shared/tool-card"
import { formatKB, type ImageKind, type OutputFormat } from "@/lib/compress"
import { AppError, toAppError } from "@/lib/errors"
import { fileKind, useIncomingFile, useReportInUse } from "@/lib/file-library"
import type { Preset } from "@/lib/presets"
import { runCompress } from "@/lib/run-compress"
import type { Prefill } from "@/components/tools-app"

interface Source {
  file: File
  url: string
  width: number
  height: number
}

/** Wait for typing to settle before re-encoding. */
const DEBOUNCE_MS = 450

export function ResizerApp({ prefill }: { prefill?: Prefill }) {
  const t = useTranslations("image")
  const tc = useTranslations("common")
  const [source, setSource] = useState<Source | null>(null)
  const [loadError, setLoadError] = useState<AppError | null>(null)
  const [settings, setSettings] = useState<Settings>(() => ({
    ...INITIAL_SETTINGS,
    ...(prefill?.maxKB ? { maxKB: String(prefill.maxKB) } : {}),
    ...(prefill?.imageKind ? { kind: prefill.imageKind } : {}),
  }))
  const [result, setResult] = useState<ResizedImage | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const runId = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const resultUrl = useRef<string | null>(null)

  function replaceResult(next: ResizedImage | null) {
    if (resultUrl.current && resultUrl.current !== next?.url) URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = next?.url ?? null
    setResult(next)
  }

  /** Resize automatically whenever the inputs are complete. */
  function schedule(src: Source | null, s: Settings, delay = DEBOUNCE_MS) {
    runId.current++
    window.clearTimeout(timer.current)
    setError(null)
    if (!src || !isReady(s)) {
      setPending(false)
      replaceResult(null)
      return
    }
    setPending(true)
    const id = runId.current
    timer.current = window.setTimeout(() => run(id, src, s), delay)
  }

  async function run(id: number, src: Source, s: Settings) {
    const maxKB = Number(s.maxKB)
    const minKB = s.minKB ? Number(s.minKB) : undefined
    try {
      const out = await runCompress(src.file, {
        kind: s.kind,
        // Portals disagree on 1 KB = 1000 or 1024 bytes, so pick the stricter
        // reading for each bound: the file passes either way.
        maxBytes: maxKB * 1000,
        minBytes: minKB ? minKB * 1024 : undefined,
        width: s.width ? Number(s.width) : undefined,
        height: s.height ? Number(s.height) : undefined,
        format: s.format,
        cleanSignature: s.cleanSignature,
        cleanDocument: s.cleanDocument,
      })
      if (id !== runId.current) return
      replaceResult({ ...out, url: URL.createObjectURL(out.blob), kind: s.kind, maxKB, minKB })
    } catch (err) {
      if (id !== runId.current) return
      replaceResult(null)
      setError(toAppError(err))
    }
    setPending(false)
  }

  function update(patch: Partial<Settings>, delay?: number) {
    const next = { ...settings, ...patch }
    setSettings(next)
    schedule(source, next, delay)
  }

  /** Take the file out of this tool; it stays in "Your files". */
  function removeSource() {
    if (source) URL.revokeObjectURL(source.url)
    setSource(null)
    setLoadError(null)
    schedule(null, settings)
  }

  async function handleFile(file: File) {
    if (source?.file === file) return
    setLoadError(null)
    if (source) URL.revokeObjectURL(source.url)
    setSource(null)
    schedule(null, settings)
    if (fileKind(file) !== "image") {
      setLoadError(new AppError("notImage"))
      return
    }
    try {
      const bitmap = await createImageBitmap(file)
      const next = { file, url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height }
      bitmap.close()
      setSource(next)
      schedule(next, settings, 0)
    } catch {
      setLoadError(new AppError("decode"))
    }
  }

  // Files arrive from the shared files bar above the tool.
  useIncomingFile("image", handleFile)
  useReportInUse(source ? [source.file] : [], useCurrentTool() === "image")

  /** Size limits carry over; an exact pixel size never does (photo ≠ signature). */
  function switchKind(kind: ImageKind) {
    update({ kind, width: "", height: "" }, 0)
  }

  function applyPreset(p: Preset) {
    update(presetValues(p), 0)
  }

  const errors = validate(settings)
  const status = !source
    ? "noImage"
    : settings.maxKB === ""
      ? "noLimit"
      : pending
        ? "working"
        : result
          ? "done"
          : "invalid"

  return (
    <div className="flex flex-col gap-6">
      <ToolCard
        footer={
          <>
            <ToolStatus
              state={status === "working" ? "working" : status === "done" ? "done" : "idle"}
            >
              {t(`status.${status}`)}
            </ToolStatus>
            <AdvancedSheet settings={settings} errors={errors} onChange={(patch) => update(patch)} />
          </>
        }
      >
        {source && (
          <div className="flex items-center gap-4">
            <img
              src={source.url}
              alt=""
              className="size-12 shrink-0 rounded-lg border border-hairline bg-surface-soft object-contain"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate type-body-sm-strong text-ink">{source.file.name}</p>
              <p className="type-body-sm tabular-nums text-body">
                {formatKB(source.file.size)} · {source.width}×{source.height}
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
        )}

        <ErrorAlert error={loadError} title={tc("couldntOpen")} />

        <Row label={t("kind")}>
          <Segmented<ImageKind>
            label={t("kind")}
            value={settings.kind}
            options={[
              { value: "photo", label: t("photo"), icon: UserRound },
              { value: "signature", label: t("signature"), icon: PenLine },
              { value: "document", label: t("document"), icon: FileText },
            ]}
            onChange={switchKind}
          />
        </Row>

        <Row
          label={tc("maxSize")}
          htmlFor="maxKB"
          error={errors.maxKB && t(`validation.${errors.maxKB}`)}
        >
          <div className="flex flex-col gap-3">
            <KBInput
              id="maxKB"
              className="sm:max-w-48"
              placeholder={tc("kbPlaceholder")}
              value={settings.maxKB}
              invalid={!!errors.maxKB}
              onChange={(v) => update({ maxKB: decimal(v) })}
            />
            <PresetPicker
              isActive={(p) => isActivePreset(p, settings)}
              onApply={applyPreset}
            />
          </div>
        </Row>

        {/* JPG is accepted almost everywhere and gives the smallest files. */}
        <Row label={tc("format")}>
          <Segmented<OutputFormat>
            label={tc("format")}
            value={settings.format}
            options={[
              { value: "image/jpeg", label: tc("jpg") },
              { value: "image/png", label: tc("png") },
            ]}
            onChange={(format) => update({ format }, 0)}
          />
        </Row>
      </ToolCard>

      <ErrorAlert error={error} />

      {result && source ? (
        <ResultPanel original={source} result={result} busy={pending} />
      ) : (
        pending && <ResultSkeleton label={t("status.working")} />
      )}
    </div>
  )
}

function presetValues(p: Preset): Pick<Settings, "maxKB" | "minKB" | "width" | "height"> {
  return {
    maxKB: String(p.maxKB),
    minKB: p.minKB ? String(p.minKB) : "",
    width: p.width ? String(p.width) : "",
    height: p.height ? String(p.height) : "",
  }
}

/** The preset whose limits (and pixel size, if any) are exactly what's entered. */
function isActivePreset(p: Preset, s: Settings) {
  const v = presetValues(p)
  return s.maxKB === v.maxKB && s.minKB === v.minKB && s.width === v.width && s.height === v.height
}
