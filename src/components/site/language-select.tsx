import { lazy, Suspense } from "react"
import { ChevronDownIcon, Languages } from "lucide-react"

import { useIntent } from "@/components/shared/use-intent"
import { selectTriggerClass } from "@/components/ui/select-styles"
import type { Locale } from "@/i18n/routing"

const loadMenu = () => import("@/components/site/language-menu")
const LanguageMenu = lazy(() => loadMenu().then((m) => ({ default: m.LanguageMenu })))

/**
 * Header language picker. The dropdown's code loads only once someone reaches
 * for it; until then a look-alike button stands in, so it costs nothing on the
 * first load of every page.
 */
export function LanguageSelect(props: {
  locale: Locale
  label: string
  languages: Record<Locale, string>
}) {
  const [intent, bind] = useIntent(loadMenu)
  const standIn = (
    <button type="button" aria-label={props.label} data-size="default" className={selectTriggerClass} {...bind}>
      <Languages className="text-body" />
      <span data-slot="select-value" className="flex flex-1 text-left">
        {props.languages[props.locale]}
      </span>
      <ChevronDownIcon className="pointer-events-none size-4 text-body" />
    </button>
  )
  if (!intent) return standIn
  return (
    <Suspense fallback={standIn}>
      <LanguageMenu {...props} defaultOpen={intent === "open"} autoFocus={intent !== "load"} />
    </Suspense>
  )
}
