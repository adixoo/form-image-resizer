
import { useRef, useState } from "react"
import { RotateCw, X } from "lucide-react"
import { useTranslations } from "use-intl"

import { useCurrentTool } from "@/components/shared/tool-context"
import { Button } from "@/components/ui/button"
import { KBInput, Row } from "@/components/resizer/fields"
import { decimal } from "@/components/resizer/settings"
import { ErrorAlert } from "@/components/shared/error-alert"
import { ResultCard, ResultSkeleton } from "@/components/shared/result-card"
import { Segmented } from "@/components/shared/segmented"
import { ToolCard, ToolStatus } from "@/components/shared/tool-card"
import { decode, encode, formatKB, type AnyCanvas } from "@/lib/compress"
import { AppError, toAppError } from "@/lib/errors"
import { useIncomingFile, useReportInUse } from "@/lib/file-library"
import { makeIdSheet, rotateQuarter, type CardSize, type SheetFormat } from "@/lib/id-card"
import { cn } from "@/lib/utils"

type Side = "front" | "back"

interface Card {
  file: File
  base: AnyCanvas
  turns: number
  /** base rotated by `turns`, used for the sheet and the preview */
  canvas: AnyCanvas
  url: string
}

interface Options {
  size: CardSize
  format: SheetFormat
  maxKB: string
}

interface Sheet {
  url: string
  blob: Blob
  previewUrl: string
  size: number
  format: SheetFormat
}

const DEBOUNCE_MS = 400

export function IdCardApp() {
  const t = useTranslations("idCard")
  const tc = useTranslations("common")
  const tv = useTranslations("image.validation")
  const [cards, setCards] = useState<Record<Side, Card | null>>({ front: null, back: null })
  const [options, setOptions] = useState<Options>({ size: "actual", format: "pdf", maxKB: "" })
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [loadError, setLoadError] = useState<AppError | null>(null)
  const runId = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const sheetUrls = useRef<string[]>([])
  // Card loads are async; the ref keeps two overlapping loads from overwriting each other.
  const cardsRef = useRef(cards)

  function replaceSheet(next: Sheet | null) {
    sheetUrls.current.forEach((u) => URL.revokeObjectURL(u))
    sheetUrls.current = next ? [next.url, next.previewUrl] : []
    setSheet(next)
  }

  function schedule(c: Record<Side, Card | null>, o: Options, delay = DEBOUNCE_MS) {
    const id = ++runId.current
    window.clearTimeout(timer.current)
    setError(null)
    const list = [c.front, c.back].filter((x): x is Card => x !== null)
    const max = Number(o.maxKB)
    if (list.length === 0 || (o.maxKB !== "" && !(max >= 1))) {
      setPending(false)
      if (list.length === 0) replaceSheet(null)
      return
    }
    setPending(true)
    timer.current = window.setTimeout(async () => {
      try {
        const out = await makeIdSheet(
          list.map((x) => x.canvas),
          { size: o.size, format: o.format, maxBytes: o.maxKB ? max * 1000 : undefined }
        )
        if (id !== runId.current) return
        replaceSheet({
          url: URL.createObjectURL(out.blob),
          blob: out.blob,
          previewUrl: URL.createObjectURL(out.preview),
          size: out.blob.size,
          format: o.format,
        })
      } catch (err) {
        if (id !== runId.current) return
        replaceSheet(null)
        setError(toAppError(err))
      }
      setPending(false)
    }, delay)
  }

  function setCard(side: Side, card: Card | null) {
    const old = cardsRef.current[side]
    if (old && old.url !== card?.url) URL.revokeObjectURL(old.url)
    const next = { ...cardsRef.current, [side]: card }
    cardsRef.current = next
    setCards(next)
    schedule(next, options, 0)
  }

  async function makeCard(file: File, base: AnyCanvas, turns: number): Promise<Card> {
    const canvas = rotateQuarter(base, turns)
    const url = URL.createObjectURL(await encode(canvas, "image/jpeg", 0.8))
    return { file, base, turns, canvas, url }
  }

  async function handleFile(side: Side, file: File) {
    setLoadError(null)
    try {
      const card = await makeCard(file, await decode(file), 0)
      setCard(side, card)
    } catch (err) {
      setLoadError(toAppError(err))
    }
  }

  async function rotate(side: Side) {
    const card = cardsRef.current[side]
    if (card) setCard(side, await makeCard(card.file, card.base, card.turns + 1))
  }

  // Files arrive from the shared files bar: they fill the front, then the back
  // (replacing the back once both are set). Tapping a card in use takes it out.
  useIncomingFile("idCard", (file) => {
    const current = cardsRef.current
    const side = (["front", "back"] as const).find((s) => current[s]?.file === file)
    if (side) setCard(side, null)
    else handleFile(current.front ? "back" : "front", file)
  })
  const cardFiles = [cards.front?.file, cards.back?.file].filter((f): f is File => !!f)
  useReportInUse(cardFiles, useCurrentTool() === "idCard")

  function update(patch: Partial<Options>, delay?: number) {
    const next = { ...options, ...patch }
    setOptions(next)
    schedule(cardsRef.current, next, delay)
  }

  const hasCard = cards.front !== null || cards.back !== null
  const maxInvalid = options.maxKB !== "" && !(Number(options.maxKB) >= 1)

  return (
    <div className="flex flex-col gap-6">
      <ToolCard
        footer={
          <ToolStatus state={pending ? "working" : sheet ? "done" : "idle"}>
            {!hasCard ? t("status.noCards") : pending ? t("status.working") : sheet ? t("status.done") : null}
          </ToolStatus>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {(["front", "back"] as const).map((side) => (
            <CardSlot
              key={side}
              label={t(side)}
              emptyLabel={t("pickSide")}
              next={side === (cards.front ? "back" : "front") && !(cards.front && cards.back)}
              card={cards[side]}
              onRotate={() => rotate(side)}
              onRemove={() => setCard(side, null)}
              rotateLabel={tc("rotate")}
              removeLabel={tc("remove")}
            />
          ))}
        </div>
        <p className="-mt-2 type-body-sm text-body">{t("tip")}</p>

        <ErrorAlert error={loadError} title={tc("couldntOpen")} />

        <div className="flex flex-col gap-4">
          <Row label={t("cardSize")} hint={options.size === "actual" ? t("actualHint") : undefined}>
            <Segmented<CardSize>
              label={t("cardSize")}
              value={options.size}
              options={[
                { value: "actual", label: t("actual") },
                { value: "large", label: t("large") },
              ]}
              onChange={(size) => update({ size }, 0)}
            />
          </Row>
          <Row label={tc("format")}>
            <Segmented<SheetFormat>
              label={tc("format")}
              value={options.format}
              options={[
                { value: "pdf", label: tc("pdf") },
                { value: "jpg", label: tc("jpg") },
                { value: "png", label: tc("png") },
              ]}
              onChange={(format) => update({ format }, 0)}
            />
          </Row>
          <Row
            label={tc("maxSizeOptional")}
            htmlFor="idMaxKB"
            error={maxInvalid ? tv("maxMin") : undefined}
          >
            <KBInput
              id="idMaxKB"
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

      {!sheet && pending && <ResultSkeleton label={t("status.working")} previews={1} />}

      {sheet && (
        <ResultCard
          split
          busy={pending}
          title={tc("readyTitle")}
          description={t("resultBody", { size: formatKB(sheet.size) })}
          download={{
            url: sheet.url,
            blob: sheet.blob,
            fileName: `id-card_a4_${Math.max(1, Math.floor(sheet.size / 1024))}kb.${sheet.format}`,
            format: tc(sheet.format),
          }}
        >
          <div className="flex justify-center">
            <img
              src={sheet.previewUrl}
              alt=""
              className="aspect-[210/297] max-h-96 rounded-sm bg-white object-contain"
            />
          </div>
        </ResultCard>
      )}
    </div>
  )
}

function CardSlot({
  label,
  emptyLabel,
  next,
  card,
  onRotate,
  onRemove,
  rotateLabel,
  removeLabel,
}: {
  label: string
  emptyLabel: string
  /** This side gets the next file tapped in the files bar. */
  next: boolean
  card: Card | null
  onRotate: () => void
  onRemove: () => void
  rotateLabel: string
  removeLabel: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="type-body-sm-strong text-ink">{label}</p>
      {card ? (
        <div className="flex flex-col gap-2">
          <div className="flex aspect-[85.6/53.98] items-center justify-center overflow-hidden rounded-lg border border-hairline bg-surface-soft">
            <img src={card.url} alt={label} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={onRotate} aria-label={rotateLabel} title={rotateLabel}>
              <RotateCw />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
              <X />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex aspect-[85.6/53.98] items-center justify-center rounded-lg border border-dashed px-3 text-center type-caption-sm",
            next ? "border-ink bg-surface-soft text-ink" : "border-hairline-strong text-mute"
          )}
        >
          {emptyLabel}
        </div>
      )}
    </div>
  )
}
