import { Languages } from "lucide-react"
import { navigate } from "astro:transitions/client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { localizedPath, parsePath, type Locale } from "@/i18n/routing"

/**
 * Language picker. Switches with the client router so "Your files" stay put,
 * and keeps whichever tool is open (tabs change the URL without a page load).
 */
export function LanguageMenu({
  locale,
  label,
  languages,
  defaultOpen,
  autoFocus,
}: {
  locale: Locale
  label: string
  languages: Record<Locale, string>
  defaultOpen?: boolean
  autoFocus?: boolean
}) {
  return (
    <Select
      defaultOpen={defaultOpen}
      items={languages}
      value={locale}
      onValueChange={(next) => {
        if (!next || next === locale) return
        const target = localizedPath(next as Locale, parsePath(location.pathname).href)
        // The in-page switch relies on the View Transitions API, which stalls if
        // the browser isn't rendering (e.g. a hidden tab). If it hasn't landed
        // shortly, fall back to a normal page load.
        const fallback = window.setTimeout(() => {
          if (location.pathname !== target) location.assign(target)
        }, 2500)
        // Only a successful switch cancels the fallback; a failed one lets it run.
        navigate(target).then(
          () => window.clearTimeout(fallback),
          () => {}
        )
      }}
    >
      <SelectTrigger aria-label={label} autoFocus={autoFocus}>
        <Languages className="text-body" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false} className="min-w-44">
        {Object.entries(languages).map(([code, name]) => (
          <SelectItem key={code} value={code} lang={code}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
