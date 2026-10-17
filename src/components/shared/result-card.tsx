
import { useRef, useState } from "react"
import { Check, Download, FolderPlus } from "lucide-react"
import { useTranslations } from "use-intl"

import { Button, buttonVariants } from "@/components/ui/button"
import { addToLibrary, useLibrary } from "@/lib/file-library"
import { EASE_OUT, gsap, reducedMotion, useGSAP } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * The page's one inverted surface: the finished file is the thing to look at.
 * `busy` dims it while a newer version is being made. With `split`, previews
 * (children) sit on the left and the title and buttons on the right, from md up.
 */
export function ResultCard({
  title,
  description,
  busy,
  download,
  split,
  children,
}: {
  title: string
  description: string
  busy?: boolean
  download: { url: string; blob: Blob; fileName: string; format: string }
  split?: boolean
  children?: React.ReactNode
}) {
  const t = useTranslations("common")
  const tl = useTranslations("library")
  const library = useLibrary()
  // The File we put in "Your files" for this exact result, if any.
  const [saved, setSaved] = useState<{ blob: Blob; file: File } | null>(null)
  const isSaved =
    saved?.blob === download.blob && library.some((x) => x.file === saved.file)

  const card = useRef<HTMLElement>(null)

  // On first appearance: bring the card into view, then let it rise in and
  // reveal its parts one after another. Later updates just swap content.
  useGSAP(
    () => {
      card.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" })
      if (reducedMotion() || !card.current) return
      gsap
        .timeline({ defaults: { ease: EASE_OUT } })
        .from(card.current, { y: 20, autoAlpha: 0, duration: 0.45, clearProps: "transform,opacity,visibility" })
        .from(
          card.current.children,
          { y: 10, autoAlpha: 0, duration: 0.4, stagger: 0.07, clearProps: "transform,opacity,visibility" },
          "-=0.25"
        )
    },
    { scope: card }
  )

  function save() {
    const file = new File([download.blob], download.fileName, { type: download.blob.type })
    addToLibrary([file], "result")
    setSaved({ blob: download.blob, file })
  }

  return (
    <section
      ref={card}
      className={cn(
        "surface-inverted grid gap-6 p-6 transition-opacity sm:p-8",
        // Phones: title, previews, buttons. md+: previews left; title and buttons right.
        split && "md:grid-cols-[minmax(0,1fr)_15rem] md:grid-rows-[auto_1fr] md:gap-x-8",
        busy && "opacity-60"
      )}
    >
      <header className={cn("flex flex-col gap-1", split && "md:col-start-2 md:row-start-1")}>
        <h2 className="type-heading-lg">{title}</h2>
        <p className="type-body-sm text-on-dark-mute">{description}</p>
      </header>

      {children && (
        <div className={cn("min-w-0", split && "md:col-start-1 md:row-span-2 md:row-start-1")}>
          {children}
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-2",
          split ? "md:col-start-2 md:row-start-2 md:self-end" : "sm:flex-row"
        )}
      >
        <a
          href={download.url}
          download={download.fileName}
          aria-disabled={busy}
          className={cn(
            buttonVariants({ variant: "inverse", size: "lg" }),
            !split && "sm:flex-1",
            busy && "pointer-events-none"
          )}
        >
          <Download /> {t("download", { format: download.format })}
        </a>
        {/* Lets another tool use this result without downloading it first. */}
        <Button
          variant="outline"
          size="lg"
          disabled={busy || isSaved}
          onClick={save}
          className="border-on-dark/25 bg-transparent text-on-dark hover:bg-on-dark/10 disabled:border-on-dark/15 disabled:bg-transparent disabled:text-on-dark-mute"
        >
          {isSaved ? <Check /> : <FolderPlus />}
          {isSaved ? tl("kept") : tl("keep")}
        </Button>
      </div>
    </section>
  )
}

/** Image preview tile inside the dark result card, on white like the portal shows it. */
export function ResultPreview({ label, url, meta }: { label: string; url: string; meta: string }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white p-2">
        <img src={url} alt={label} className="max-h-full max-w-full object-contain" />
      </div>
      <figcaption className="flex flex-col">
        <span className="type-body-sm-strong">{label}</span>
        <span className="type-body-sm tabular-nums text-on-dark-mute">{meta}</span>
      </figcaption>
    </figure>
  )
}

/** Placeholder in the result card's shape while the first result is being made. */
export function ResultSkeleton({ label, previews = 2 }: { label: string; previews?: 0 | 1 | 2 }) {
  const block = "rounded-md bg-on-dark/10 motion-safe:animate-pulse"
  const split = previews > 0
  return (
    <section
      aria-busy="true"
      aria-label={label}
      className={cn(
        "surface-inverted grid gap-6 p-6 sm:p-8",
        split && "md:grid-cols-[minmax(0,1fr)_15rem] md:grid-rows-[auto_1fr] md:gap-x-8"
      )}
    >
      <div className={cn("flex flex-col gap-2", split && "md:col-start-2 md:row-start-1")}>
        <div className={cn(block, "h-7 w-44 max-w-full")} />
        <div className={cn(block, "h-4 w-60 max-w-full")} />
      </div>
      {split && (
        <div
          className={cn(
            "grid gap-3 md:col-start-1 md:row-span-2 md:row-start-1",
            previews === 2 ? "grid-cols-2" : "grid-cols-1"
          )}
        >
          {Array.from({ length: previews }, (_, i) => (
            <div
              key={i}
              className={cn(block, "aspect-square rounded-lg", previews === 1 && "mx-auto aspect-[210/297] h-72")}
            />
          ))}
        </div>
      )}
      <div className={cn("flex flex-col gap-2", split && "md:col-start-2 md:row-start-2 md:self-end")}>
        <div className={cn(block, "h-12 rounded-full")} />
        {split && <div className={cn(block, "h-12 rounded-full")} />}
      </div>
    </section>
  )
}
