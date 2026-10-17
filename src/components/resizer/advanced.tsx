import { lazy, Suspense } from "react"
import { SlidersHorizontal } from "lucide-react"
import { useTranslations } from "use-intl"

import { useIntent } from "@/components/shared/use-intent"
import { Button } from "@/components/ui/button"
import { advancedSummary, type SettingErrors, type Settings } from "@/components/resizer/settings"

const loadSheet = () => import("@/components/resizer/advanced-sheet")
const AdvancedSheet = lazy(() => loadSheet().then((m) => ({ default: m.AdvancedSheet })))

/**
 * The "Advanced" button. The side panel (and the dialog code behind it) loads
 * only once someone reaches for the button; until then a look-alike stands in.
 */
export function Advanced(props: {
  settings: Settings
  errors: SettingErrors
  onChange: (patch: Partial<Settings>) => void
}) {
  const [intent, bind] = useIntent(loadSheet)
  const standIn = (
    <Button variant="ghost" size="sm" className="-mr-3 shrink-0" {...bind}>
      <AdvancedLabel count={advancedSummary(props.settings).length} />
    </Button>
  )
  if (!intent) return standIn
  return (
    <Suspense fallback={standIn}>
      <AdvancedSheet {...props} defaultOpen={intent === "open"} autoFocus={intent !== "load"} />
    </Suspense>
  )
}

/** Icon, label and how many advanced options are in use. */
export function AdvancedLabel({ count }: { count: number }) {
  const tc = useTranslations("common")
  return (
    <>
      <SlidersHorizontal data-icon="inline-start" />
      {tc("advanced")}
      {count > 0 && (
        <span className="flex size-5 items-center justify-center rounded-full bg-ink type-caption-sm text-on-dark">
          {count}
        </span>
      )}
    </>
  )
}
