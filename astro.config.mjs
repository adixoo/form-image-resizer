// @ts-check
import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"

// Fully static site: every tool runs in the browser, there is no server code.
export default defineConfig({
  site: "https://formseva.adibitz.com",
  // One spelling per URL ("/hi/id-card", never "/hi/id-card/"), matching the
  // canonical and hreflang tags. Pages build as hi/id-card.html etc., which
  // static hosts serve at the slash-free address.
  trailingSlash: "never",
  build: { format: "file" },
  // The sitemap is a single file, src/pages/sitemap.xml.ts.
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  // Not using Astro's built-in CSP: it can't be combined with <ClientRouter />,
  // which keeps "Your files" in memory between tools. The policy is set in
  // src/layouts/base.astro (meta) and vercel.json (hosting) instead.
})
