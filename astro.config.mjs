// @ts-check
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

// Keep in sync with src/i18n/routing.ts. Region tags tell search engines these
// pages are for India.
const LOCALES = ["en", "hi", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa", "or"]

// Fully static site: every tool runs in the browser, there is no server code.
export default defineConfig({
  site: "https://formready.adibitz.com",
  // One spelling per URL ("/hi/id-card", never "/hi/id-card/"), matching the
  // canonical and hreflang tags. Pages build as hi/id-card.html etc., which
  // static hosts serve at the slash-free address.
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [
    react(),
    sitemap({
      // English lives at "/", other languages under "/hi", "/ta", …; the
      // sitemap links every language version of a page to the others.
      i18n: {
        defaultLocale: "en",
        locales: Object.fromEntries(LOCALES.map((l) => [l, `${l}-IN`])),
      },
      filter: (page) => !page.includes("/404"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  // Not using Astro's built-in CSP: it can't be combined with <ClientRouter />,
  // which keeps "Your files" in memory between tools. The policy is set in
  // src/layouts/base.astro (meta) and vercel.json (hosting) instead.
})
