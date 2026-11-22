import { startTransition, use, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Lock } from "lucide-react"
import { IntlProvider, useTranslations } from "use-intl"

import { FilesBar } from "@/components/shared/files-bar"
import { ToolContext } from "@/components/shared/tool-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Messages } from "@/i18n/messages"
import { localizedPath, parsePath, type Locale } from "@/i18n/routing"
import { brandTitle } from "@/lib/brand"
import type { ImageKind } from "@/lib/compress"
import type { ToolId } from "@/lib/file-library"
import { EASE_OUT, motion, reducedMotion, whenIdle } from "@/lib/motion"
import { TOOLS } from "@/lib/tools"

/** Values a keyword page fills in, e.g. /resize-image-to-50kb → photo, 50 KB. */
export interface Prefill {
  maxKB?: number
  imageKind?: ImageKind
}

type ToolComponent = React.ComponentType<{ prefill?: Prefill }>

// Each tool's code is its own download. The page's starting tool is loaded
// before rendering (the page build awaits preloadTool, so its HTML is complete
// in the page; the browser hydrates once its code is in). The others load when
// the page is idle, or sooner if their tab is pointed at or focused.
const LOADERS: Record<ToolId, () => Promise<ToolComponent>> = {
  image: () => import("@/components/resizer/resizer-app").then((m) => m.ResizerApp),
  pdf: () => import("@/components/pdf/pdf-compress-app").then((m) => m.PdfCompressApp),
  idCard: () => import("@/components/id-card/id-card-app").then((m) => m.IdCardApp),
  merge: () => import("@/components/pdf/pdf-merge-app").then((m) => m.PdfMergeApp),
  toPdf: () => import("@/components/pdf/image-to-pdf-app").then((m) => m.ImageToPdfApp),
}
const READY: Partial<Record<ToolId, ToolComponent>> = {}
const PRELOADS: Partial<Record<ToolId, Promise<void>>> = {}

export function preloadTool(id: ToolId) {
  return (PRELOADS[id] ??= LOADERS[id]().then((App) => {
    READY[id] = App
  }))
}

/**
 * A tool, once its code is in. Tool switches are transitions, so if the code
 * is still on its way the current tool stays on screen until it arrives
 * instead of flashing a placeholder.
 */
function ToolPanel({ id, prefill }: { id: ToolId; prefill?: Prefill }) {
  if (!READY[id]) use(preloadTool(id))
  const App = READY[id]!
  return <App prefill={prefill} />
}

/**
 * The whole page body: hero, tool tabs, the shared files bar and every
 * tools. Tabs switch tools in place (no page load) and keep the address bar,
 * title and back button in sync. A tool mounts when first opened and then
 * stays mounted, so switching back shows exactly what was left there.
 */
export function ToolsApp({
  initialTool,
  locale,
  messages,
  prefill,
  page,
}: {
  initialTool: ToolId
  locale: Locale
  messages: Messages
  prefill?: Prefill
  /** Keyword pages: their own heading, title and address for the first tool. */
  page?: { heading: string; title: string; href: string }
}) {
  return (
    <IntlProvider locale={locale} messages={messages} timeZone="Asia/Kolkata">
      <Tools initialTool={initialTool} locale={locale} prefill={prefill} page={page} />
    </IntlProvider>
  )
}

function Tools({
  initialTool,
  locale,
  prefill,
  page,
}: {
  initialTool: ToolId
  locale: Locale
  prefill?: Prefill
  page?: { heading: string; title: string; href: string }
}) {
  const t = useTranslations()
  const [tool, setTool] = useState(initialTool)
  const [opened, setOpened] = useState<ReadonlySet<ToolId>>(() => new Set([initialTool]))
  if (!opened.has(tool)) setOpened(new Set(opened).add(tool))
  // On a keyword page, the first tool's tab keeps that page's own address, so
  // switching away and back returns to "/resize-image-to-50kb", not "/".
  const pageHref = page?.href
  const hrefOf = (id: ToolId) =>
    id === initialTool && pageHref ? pageHref : TOOLS.find((x) => x.id === id)!.href
  const root = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  function open(next: ToolId, href: string) {
    if (next === tool) return
    // Stateless entry: Astro's router ignores it, our popstate handler owns it.
    history.pushState(null, "", localizedPath(locale, href))
    startTransition(() => setTool(next))
  }

  useEffect(() => whenIdle(() => TOOLS.forEach(({ id }) => void preloadTool(id))), [])

  // Back/forward between tools of this language: switch in place. Runs in the
  // capture phase so it wins over Astro's router, which would reload the page.
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const { locale: l, href } = parsePath(location.pathname)
      const target = TOOLS.find((x) => (x.id === initialTool && pageHref ? pageHref : x.href) === href)
      if (l !== locale || !target) return
      e.stopImmediatePropagation()
      startTransition(() => setTool(target.id))
    }
    window.addEventListener("popstate", onPopState, { capture: true })
    return () => window.removeEventListener("popstate", onPopState, { capture: true })
  }, [locale, initialTool, pageHref])

  // The static help text under the tool belongs to one tool; CSS shows it only
  // while that tool is open (see [data-seo-for] in globals.css).
  useEffect(() => {
    document.body.dataset.tool = tool
    document.title = brandTitle(
      tool === initialTool && page ? page.title : tool === "image" ? t("meta.title") : t(`${tool}.metaTitle`)
    )
  }, [tool, t, initialTool, page])

  // A switched-in tool rises in like the page did on load.
  useLayoutEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const gsap = motion()?.gsap
    if (!gsap || reducedMotion() || !root.current) return
    gsap.from(root.current.querySelectorAll("[data-switch]"), {
      y: 10,
      autoAlpha: 0,
      duration: 0.4,
      ease: EASE_OUT,
      stagger: 0.05,
      clearProps: "transform,opacity,visibility",
    })
  }, [tool])

  return (
    <ToolContext.Provider value={tool}>
      {/*
        One column on every screen: hero and tabs, the files bar, then the tool.
        The whole grid is the Tabs root, so the tab list (in the hero) and the
        tool panels (in the main column) belong to one Tabs component.
      */}
      <Tabs
        ref={root}
        value={tool}
        onValueChange={(next) => {
          const target = TOOLS.find((x) => x.id === next)
          if (target) open(target.id, hrefOf(target.id))
        }}
        render={<main id="main" />}
        className="flex flex-col gap-4 py-8 sm:py-10"
      >
        <header className="mb-6 flex flex-col items-center pt-4 text-center sm:pt-8">
          <p
            data-enter="0"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3.5 py-1.5 type-caption-sm font-medium text-charcoal"
          >
            <Lock className="size-3.5 shrink-0" strokeWidth={2} />
            {t("site.private")}
          </p>
          <h1 data-enter="1" data-switch className="mt-5 max-w-[22ch] type-display-hero text-ink">
            {tool === initialTool && page ? page.heading : t(`${tool}.title`)}
          </h1>
          <p data-switch className="mt-4 max-w-[36rem] type-body-md text-body sm:text-[1.0625rem]">
            {t(`${tool}.subtitle`)}
          </p>
          {/* Scrolls sideways on narrow phones instead of wrapping. */}
          <div data-enter="2" className="-mx-4 mt-8 flex w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none]">
            {/* Soft track groups the tabs into one control, like the other switches. */}
            <div className="mx-auto rounded-full bg-surface-soft p-1">
              <TabsList>
                {TOOLS.map(({ id, icon: Icon }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    className="hover:bg-canvas"
                    // Real links: they work without JS, can be shared, and open
                    // in a new tab on Ctrl/⌘-click.
                    nativeButton={false}
                    render={<a href={localizedPath(locale, hrefOf(id))} />}
                    onPointerEnter={() => void preloadTool(id)}
                    onFocus={() => void preloadTool(id)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
                        e.preventBaseUIHandler()
                        return
                      }
                      e.preventDefault()
                    }}
                  >
                    <Icon strokeWidth={1.75} />
                    {t(`nav.${id}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
        </header>

        <aside data-enter="3">
          <FilesBar />
        </aside>

        <div data-enter="4" className="min-w-0">
          {TOOLS.map(({ id }) => (
            // keepMounted: every opened tool keeps its file, settings and result.
            <TabsContent key={id} value={id} keepMounted data-switch={id === tool ? "" : undefined}>
              {opened.has(id) && <ToolPanel id={id} prefill={id === initialTool ? prefill : undefined} />}
            </TabsContent>
          ))}
        </div>

      </Tabs>
    </ToolContext.Provider>
  )
}
