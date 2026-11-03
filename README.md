# FormSeva

Resize photos and signatures to the exact KB limit of Indian government and exam forms, compress PDFs, put both sides of an ID card on one A4 page, and merge PDFs. Available in English and 10 Indian languages.

Everything runs in the browser. Files never leave the device: there is no server code, and the Content Security Policy blocks the page from sending data anywhere except Cloudflare Web Analytics page-view beacons (`connect-src 'self' https://cloudflareinsights.com`).

## Stack

- [Astro](https://astro.build) (static output) with React islands for the tools
- Tailwind CSS v4 and shadcn/ui (Base UI) components
- `use-intl` for translations (`messages/*.json`, English is the fallback)
- `pdf.js` to render PDF pages, `pdf-lib` to write PDFs

## Develop

```bash
bun install
bun run dev
```

The site runs at http://localhost:4321. `predev`/`prebuild` copy the pdf.js worker, fonts and decoders into `public/pdfjs` so they are served from the site's own origin.

## Build

```bash
bun run build
bun run preview
```

`dist/` is a plain static site, hosted on Vercel. `vercel.json` sets the build, serves `/hi/id-card` from `hi/id-card.html` (`cleanUrls`, no trailing slash), and adds the security headers plus long-lived caching for the hashed files in `/_astro`. Import the GitHub repo in Vercel and it deploys `master` with these settings; no adapter is needed.

## SEO

- Live at https://formseva.adibitz.com (`site` in `astro.config.mjs`).
- Every page has a canonical URL, `hreflang` links to all 11 languages, Open Graph/Twitter tags with `public/og.png`, and JSON-LD (WebApplication, FAQPage, breadcrumbs).
- Keyword pages for popular sizes (`src/lib/seo-pages.ts`), e.g. `/resize-image-to-50kb`, `/resize-signature-to-20kb`, `/compress-pdf-to-200kb`, in every language. Each opens the tool with that size filled in. Add a size there and it gets a page, a sitemap entry and a "Popular sizes" link.
- `src/pages/sitemap.xml.ts` writes a single `sitemap.xml` (no sitemap index) listing every page in every language with its language alternates; `public/robots.txt` points to it. URLs never end in a slash.

## Layout

- `src/pages/[...slug].astro` builds one page per language × tool and keyword page (`/`, `/pdf-compress`, `/hi/id-card`, `/resize-image-to-50kb`, …)
- `src/layouts/base.astro` holds the head, CSP and the client router (which keeps "Your files" in memory between pages)
- `src/components/tools-app.tsx` is the interactive part of each page: hero, tool tabs, the shared files bar and all four tools (tabs switch in place)
- `src/components/site/seo-content.astro` is the static help text (steps, FAQ, popular sizes) under the tool
- `src/lib/` has the image, PDF and ID-card engines
