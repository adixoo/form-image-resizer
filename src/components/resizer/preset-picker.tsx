import { Check } from "lucide-react"
import { useTranslations } from "use-intl"

import { PRESETS, type Preset } from "@/lib/presets"
import { cn } from "@/lib/utils"

/** Small chips that fill in a common size limit: "Under 50 KB", "Under 1 MB". */
export function PresetPicker({
  isActive,
  onApply,
}: {
  isActive: (p: Preset) => boolean
  onApply: (p: Preset) => void
}) {
  const t = useTranslations("image")
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => {
        const active = isActive(p)
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => onApply(p)}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 type-caption-sm font-medium text-ink transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "border-ink bg-canvas"
                : "border-transparent bg-surface-soft hover:bg-hairline/60"
            )}
          >
            {active && <Check className="-ml-0.5 size-3" strokeWidth={2.5} />}
            {p.maxKB >= 1000
              ? t("presetUnderMB", { max: p.maxKB / 1000 })
              : t("presetUnder", { max: p.maxKB })}
          </button>
        )
      })}
    </div>
  )
}
