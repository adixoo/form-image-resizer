import { getTranslator } from "@/i18n/messages"
import { BRAND_ALIASES } from "@/lib/brand"
import { DEFAULT_LOCALE, localizedPath, type Locale } from "@/i18n/routing"
import type { ToolId } from "./file-library"
import { LANDING_PAGES, sizeLabel, type LandingPage } from "./seo-pages"
import { TOOLS } from "./tools"

type T = ReturnType<typeof getTranslator>

/** FAQ items for a tool, in the page's language. */
export function faqFor(t: T, tool: ToolId): { q: string; a: string }[] {
  return (["1", "2", "3"] as const).map((n) =>
    tool === "image"
      ? { q: t(`image.faq.q${n}`), a: t(`image.faq.a${n}`) }
      : { q: t(`seo.faq.${tool}.q${n}`), a: t(`seo.faq.${tool}.a${n}`) }
  )
}

/** How-it-works steps for a tool. */
export function stepsFor(t: T, tool: ToolId): { title: string; body: string }[] {
  return (["1", "2", "3"] as const).map((n) => ({
    title: t(`seo.steps.${tool}.s${n}t`),
    body: t(`seo.steps.${tool}.s${n}b`),
  }))
}

/** Title, heading, description and intro of a keyword page. */
export function landingText(t: T, page: LandingPage) {
  const size = sizeLabel(page.maxKB)
  return {
    title: t(`seo.landing.${page.kind}.title`, { size }),
    h1: t(`seo.landing.${page.kind}.h1`, { size }),
    description: t(`seo.landing.${page.kind}.description`, { size }),
    intro: t(`seo.landing.${page.kind}.intro`, { size }),
  }
}

/** Absolute URL of a page in a language. */
export function absoluteUrl(site: URL, locale: Locale, href: string): string {
  return new URL(localizedPath(locale, href), site).href
}

/**
 * Structured data (JSON-LD) for a page: the web app itself, its FAQ, and a
 * breadcrumb trail. Search engines use it for rich results and to understand
 * that every page is a free tool.
 */
export function jsonLdFor(opts: {
  site: URL
  locale: Locale
  tool: ToolId
  href: string
  title: string
  description: string
  landing?: LandingPage
}): object[] {
  const { site, locale, tool, href, title, description, landing } = opts
  const t = getTranslator(locale)
  const url = absoluteUrl(site, locale, href)
  const toolHref = TOOLS.find((x) => x.id === tool)!.href
  const graph: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: title,
      alternateName: [t("site.brand"), ...BRAND_ALIASES],
      url,
      description,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      inLanguage: locale,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      publisher: { "@type": "Organization", name: "adibitz", url: "https://adibitz.com" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: locale,
      mainEntity: faqFor(t, tool).map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ]

  if (href === "/") {
    graph.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: t("site.brand"),
      alternateName: BRAND_ALIASES,
      url,
      inLanguage: locale,
    })
  } else {
    const crumbs = [{ name: t("seo.home"), url: absoluteUrl(site, locale, "/") }]
    if (toolHref !== "/") crumbs.push({ name: t(`nav.${tool}`), url: absoluteUrl(site, locale, toolHref) })
    if (landing) crumbs.push({ name: landingText(t, landing).h1, url })
    graph.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: c.url,
      })),
    })
  }
  return graph
}

/** Links to every keyword page, grouped, for the "Popular sizes" block. */
export function popularSizeGroups(t: T, locale: Locale) {
  const group = (kind: LandingPage["kind"], heading: string, label: (size: string) => string) => ({
    heading,
    links: LANDING_PAGES.filter((p) => p.kind === kind).map((p) => ({
      href: localizedPath(locale, p.href),
      label: label(sizeLabel(p.maxKB)),
    })),
  })
  return [
    group("image", t("seo.sizesImage"), (size) => t("seo.linkImage", { size })),
    group("signature", t("seo.sizesSignature"), (size) => t("seo.linkSignature", { size })),
    group("pdf", t("seo.sizesPdf"), (size) => t("seo.linkPdf", { size })),
  ]
}

export const OG_LOCALE: Record<Locale, string> = {
  en: "en_IN",
  hi: "hi_IN",
  bn: "bn_IN",
  mr: "mr_IN",
  te: "te_IN",
  ta: "ta_IN",
  gu: "gu_IN",
  kn: "kn_IN",
  ml: "ml_IN",
  pa: "pa_IN",
  or: "or_IN",
}

export { DEFAULT_LOCALE }
