/** English plus the major Indian regional languages, each shown in its own script. */
export const LANGUAGES = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  mr: "मराठी",
  te: "తెలుగు",
  ta: "தமிழ்",
  gu: "ગુજરાતી",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  pa: "ਪੰਜਾਬੀ",
  or: "ଓଡ଼ିଆ",
} as const

export type Locale = keyof typeof LANGUAGES

export const LOCALES = Object.keys(LANGUAGES) as Locale[]
export const DEFAULT_LOCALE: Locale = "en"

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && value in LANGUAGES
}

/**
 * The URL of a tool page in a language. English lives at "/", "/pdf-compress",
 * other languages are prefixed: "/hi", "/hi/pdf-compress".
 */
export function localizedPath(locale: Locale, toolHref: string): string {
  if (locale === DEFAULT_LOCALE) return toolHref
  return toolHref === "/" ? `/${locale}` : `/${locale}${toolHref}`
}

/** Split a URL path into its language and the tool route: "/hi/id-card" → hi, "/id-card". */
export function parsePath(pathname: string): { locale: Locale; href: string } {
  const segments = pathname.split("/").filter(Boolean)
  const locale = isLocale(segments[0]) ? (segments.shift() as Locale) : DEFAULT_LOCALE
  return { locale, href: `/${segments.join("/")}` }
}
