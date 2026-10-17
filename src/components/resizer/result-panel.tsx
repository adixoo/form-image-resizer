
import { useTranslations } from "use-intl"

import { ResultCard, ResultPreview } from "@/components/shared/result-card"
import { formatKB, type CompressResult, type ImageKind } from "@/lib/compress"

export interface ResizedImage extends CompressResult {
  url: string
  kind: ImageKind
  maxKB: number
  minKB?: number
}

export function ResultPanel({
  original,
  result,
  busy,
}: {
  original: { url: string; file: File; width: number; height: number }
  result: ResizedImage
  busy: boolean
}) {
  const t = useTranslations("image")
  const tc = useTranslations("common")
  const ext = result.blob.type === "image/png" ? "png" : "jpg"
  const sizeKB = Math.max(1, Math.floor(result.blob.size / 1024))
  const range = result.minKB ? `${result.minKB}–${result.maxKB} KB` : `${result.maxKB} KB`
  const belowMin = result.minKB !== undefined && result.blob.size < result.minKB * 1024
  const quality =
    result.quality !== null ? ` · ${t("quality", { value: Math.round(result.quality * 100) })}` : ""

  return (
    <ResultCard
      split
      busy={busy}
      title={belowMin ? t("belowMinTitle") : tc("readyTitle")}
      description={
        belowMin
          ? t("belowMinBody", { max: result.maxKB })
          : result.kept
            ? t("keptAsIs", { size: formatKB(result.blob.size), range })
            : tc("fitsLimit", { size: formatKB(result.blob.size), range })
      }
      download={{
        url: result.url,
        blob: result.blob,
        fileName: `${result.kind}_${result.width}x${result.height}_${sizeKB}kb.${ext}`,
        format: ext.toUpperCase(),
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <ResultPreview
          label={tc("original")}
          url={original.url}
          meta={`${formatKB(original.file.size)} · ${original.width}×${original.height}`}
        />
        <ResultPreview
          label={tc("result")}
          url={result.url}
          meta={`${formatKB(result.blob.size)} · ${result.width}×${result.height}${quality}`}
        />
      </div>
    </ResultCard>
  )
}
