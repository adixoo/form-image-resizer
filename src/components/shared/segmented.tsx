import { useRef } from "react"
import type { LucideIcon } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EASE_OUT, gsap, reducedMotion, useGSAP } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * Single-choice segmented switch: pills on a soft grey track with a black thumb
 * that slides to the chosen option. Full width on phones, sized to its options
 * from sm up. Until the thumb is measured (and without JS) the chosen pill
 * paints its own black background, so there is never a frame with no selection.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "default",
  label,
}: {
  value: T
  options: { value: T; label: string; icon?: LucideIcon }[]
  onChange: (value: T) => void
  size?: "default" | "sm"
  label?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  useGSAP(
    () => {
      const el = track.current
      const th = thumb.current
      if (!el || !th) return
      const place = (animate: boolean) => {
        const active = el.querySelector<HTMLElement>('[aria-pressed="true"]')
        if (!active) return
        const to = { x: active.offsetLeft, width: active.offsetWidth }
        if (animate && !reducedMotion()) {
          gsap.to(th, { ...to, duration: 0.35, ease: EASE_OUT, overwrite: true })
        } else {
          gsap.set(th, to)
        }
      }
      place(placed.current)
      if (!placed.current) {
        placed.current = true
        el.dataset.ready = ""
      }
      // Widths change with the viewport (full width on phones): re-measure.
      const ro = new ResizeObserver(() => place(false))
      ro.observe(el)
      return () => ro.disconnect()
    },
    { dependencies: [value], scope: track }
  )

  return (
    <ToggleGroup
      ref={track}
      aria-label={label}
      spacing={1}
      value={[value]}
      onValueChange={(v) => {
        if (v[0]) onChange(v[0] as T)
      }}
      className="group/seg relative flex w-full rounded-full bg-surface-soft p-1 sm:w-fit"
    >
      <span
        ref={thumb}
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-ink opacity-0 group-data-ready/seg:opacity-100"
      />
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <ToggleGroupItem
          key={v}
          value={v}
          size={size}
          className={cn(
            "relative flex-1 text-charcoal hover:bg-canvas hover:text-ink sm:flex-none",
            // Once the thumb is in place it provides the black background.
            "group-data-ready/seg:aria-pressed:bg-transparent group-data-ready/seg:aria-pressed:hover:bg-transparent",
            size === "default" ? "h-9 px-5" : "h-8 px-4"
          )}
        >
          {Icon && <Icon />}
          {l}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
