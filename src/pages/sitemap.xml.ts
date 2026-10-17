import type { APIRoute } from "astro"

import { DEFAULT_LOCALE, LOCALES } from "@/i18n/routing"
import { absoluteUrl } from "@/lib/seo-content"
import { LANDING_PAGES } from "@/lib/seo-pages"
import { TOOLS } from "@/lib/tools"

// One sitemap file (no sitemap index) listing every page in every language.
// Each entry names its versions in the other languages, matching the hreflang
// links in the page head (src/layouts/base.astro).
export const GET: APIRoute = ({ site }) => {
  const hrefs = [...TOOLS.map((t) => t.href), ...LANDING_PAGES.map((p) => p.href)]
  const urls = hrefs.flatMap((href) => {
    const alternates = [
      ...LOCALES.map((l) => link(`${l}-IN`, absoluteUrl(site!, l, href))),
      link("x-default", absoluteUrl(site!, DEFAULT_LOCALE, href)),
    ].join("")
    return LOCALES.map((l) => `<url><loc>${absoluteUrl(site!, l, href)}</loc>${alternates}</url>`)
  })
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
    urls.join("") +
    `</urlset>`
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } })
}

function link(hreflang: string, href: string) {
  return `<xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>`
}
