
import { useLayoutEffect, useRef, useState } from "react"
import { Check, FileText, Plus, UploadCloud, X } from "lucide-react"
import { useTranslations } from "use-intl"

import { Button } from "@/components/ui/button"
import { FileInput, IMAGE_TYPES, PDF_TYPES } from "@/components/shared/file-drop"
import { useCurrentTool } from "@/components/shared/tool-context"
import { formatKB } from "@/lib/compress"
import { EASE_POP, motion, reducedMotion } from "@/lib/motion"
import {
  addToLibrary,
  clearLibrary,
  removeFromLibrary,
  sendToTool,
  useInUse,
  useLibrary,
} from "@/lib/file-library"
import { TOOLS } from "@/lib/tools"
import { cn } from "@/lib/utils"

const ACCEPT = `${PDF_TYPES},${IMAGE_TYPES}`

/**
 * The one place files come in. Shared by every tool: anything added here is
 * listed right away and handed to the tool on screen; tapping a file uses it.
 *
 * A sideways-scrolling row of square tiles above the tool, on every screen.
 */
export function FilesBar() {
  const t = useTranslations("library")
  const files = useLibrary()
  const inUse = useInUse()
  const current = useCurrentTool()
  const tool = TOOLS.find((x) => x.id === current)
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  // Ids already on screen; null until the first render. Files that were here
  // before a page switch don't animate again, only ones added since.
  const seen = useRef<Set<number> | null>(null)

  useLayoutEffect(
    () => {
      const ids = files.map((f) => f.id)
      const before = seen.current
      seen.current = new Set(ids)
      const gsap = motion()?.gsap
      if (!before || !gsap || reducedMotion() || !list.current) return
      const fresh = ids
        .filter((id) => !before.has(id))
        .map((id) => list.current?.querySelector(`[data-file-id="${id}"]`))
        .filter((el): el is Element => !!el)
      if (fresh.length === 0) return
      gsap.from(fresh, {
        scale: 0.8,
        autoAlpha: 0,
        duration: 0.4,
        ease: EASE_POP,
        stagger: 0.05,
        clearProps: "transform,opacity,visibility",
      })
    },
    [files]
  )

  /** Shrink tiles away, then drop them from the list. */
  function animateOut(targets: Element[], done: () => void) {
    const gsap = motion()?.gsap
    if (!gsap || reducedMotion() || targets.length === 0) return done()
    gsap.to(targets, {
      scale: 0.8,
      autoAlpha: 0,
      duration: 0.2,
      ease: "power2.in",
      stagger: 0.03,
      onComplete: done,
    })
  }

  function add(list: File[]) {
    const entries = addToLibrary(list)
    if (!tool) return
    const usable = entries.filter((e) => tool.accepts.includes(e.kind))
    // Single-file tools get only the first file; merge and ID card take several.
    const send = tool.id === "merge" || tool.id === "idCard" ? usable : usable.slice(0, 1)
    send.forEach((e) => sendToTool(tool.id, e.file))
  }

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      add([...e.dataTransfer.files])
    },
  }

  const picker = <FileInput ref={input} accept={ACCEPT} multiple onFiles={add} />

  if (files.length === 0) {
    return (
      <button
        type="button"
        onClick={() => input.current?.click()}
        {...dropProps}
        className={cn(
          "flex w-full items-center gap-4 rounded-lg border border-dashed border-hairline-strong bg-canvas px-5 py-5 text-left transition-colors outline-none",
          "hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/50",
          dragging && "border-ink bg-surface-soft"
        )}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-soft">
          <UploadCloud className="size-5 text-ink" strokeWidth={1.75} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="type-body-strong text-ink">{t("emptyTitle")}</span>
          <span className="type-body-sm text-body">{t("emptyHint")}</span>
        </span>
        {picker}
      </button>
    )
  }

  return (
    <section
      aria-label={t("title")}
      {...dropProps}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-hairline p-4 transition-colors sm:p-5",
        dragging && "border-ink bg-surface-soft"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-body-sm-strong text-ink">
          {t("title")} <span className="type-body-sm tabular-nums text-mute">{files.length}</span>
        </h2>
        <Button
          variant="ghost"
          size="xs"
          className="-mr-2 text-body"
          onClick={() =>
            animateOut([...(list.current?.querySelectorAll("[data-file-id]") ?? [])], clearLibrary)
          }
        >
          {t("clear")}
        </Button>
      </div>

      <ul
        ref={list}
        className="-mx-4 -mt-2 flex gap-3 overflow-x-auto px-4 pt-2 pb-1 [scrollbar-width:thin] sm:-mx-5 sm:px-5"
      >
        <li className="w-20 shrink-0">
          <button type="button" onClick={() => input.current?.click()} className={tileClass}>
            <span className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-hairline-strong bg-canvas">
              <Plus className="size-5 text-ink" />
            </span>
            <span className="type-caption-sm text-ink">{t("addTile")}</span>
          </button>
          {picker}
        </li>

        {files.map((item) => {
          const used = inUse.includes(item.file)
          const usable = !tool || tool.accepts.includes(item.kind)
          return (
            <li key={item.id} data-file-id={item.id} className="group relative w-20 shrink-0">
              <button
                type="button"
                disabled={!usable}
                onClick={() => tool && sendToTool(tool.id, item.file)}
                title={item.file.name}
                aria-pressed={used}
                className={tileClass}
              >
                <span
                  className={cn(
                    "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-surface-soft",
                    used ? "border-ink ring-2 ring-ink" : "border-hairline"
                  )}
                >
                  {item.kind === "image" ? (
                    <img src={item.url} alt="" className="size-full object-cover" />
                  ) : (
                    <FileText className="size-6 text-ink" strokeWidth={1.5} />
                  )}
                  {used && (
                    <span className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-full bg-ink text-on-dark">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                  {item.source === "result" && (
                    <span className="absolute top-1 left-1 rounded-full bg-ink px-1.5 py-0.5 type-caption-sm text-on-dark">
                      {t("made")}
                    </span>
                  )}
                  {/* File type, so a JPG and a PNG of the same picture can be told apart. */}
                  <span className="absolute right-1 bottom-1 rounded-sm bg-black/65 px-1 py-px text-[0.625rem] tabular-nums leading-tight font-medium text-white">
                    {typeLabel(item.file)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate type-caption-sm text-ink">
                    {item.file.name}
                  </span>
                  <span className="-mt-1 type-caption-sm text-mute">
                    {formatKB(item.file.size)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  const tile = e.currentTarget.closest("li")
                  animateOut(tile ? [tile] : [], () => removeFromLibrary(item.id))
                }}
                aria-label={t("remove", { name: item.file.name })}
                title={t("remove", { name: item.file.name })}
                className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full border border-hairline bg-canvas text-charcoal outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <X className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>

      <p className="type-caption-sm text-mute">{t("hint")}</p>
    </section>
  )
}

/** A file tile: thumbnail with name and size under it. */
const tileClass =
  "flex w-full flex-col gap-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-35"

/** "JPG", "PNG", "PDF", "WEBP", … from the file name, else from its MIME type. */
function typeLabel(file: File): string {
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? file.type.split("/")[1] ?? ""
  const upper = ext.toUpperCase()
  return upper === "JPEG" ? "JPG" : upper
}
