import { useLayoutEffect, useRef } from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"

import { EASE_OUT, motion, placeAt, reducedMotion } from "@/lib/motion"

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs", className)}
      {...props}
    />
  )
}

/**
 * Pill tab bar. A black indicator slides (GSAP) to whichever tab is active,
 * however it became active (click, keyboard, or a value set from outside).
 * Until it is measured, and without JS, the active tab paints its own pill.
 */
function TabsList({ className, children, ...props }: TabsPrimitive.List.Props) {
  const list = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)

  useLayoutEffect(
    () => {
      const el = list.current
      const pill = indicator.current
      if (!el || !pill) return
      let placed = false
      const place = (animate: boolean) => {
        const active = el.querySelector<HTMLElement>("[data-slot=tabs-trigger][data-active]")
        if (!active) return
        const to = { x: active.offsetLeft, width: active.offsetWidth }
        const gsap = motion()?.gsap
        if (gsap && animate && placed && !reducedMotion()) {
          gsap.to(pill, { ...to, duration: 0.4, ease: EASE_OUT, overwrite: true })
        } else {
          placeAt(pill, to)
        }
        if (!placed) {
          placed = true
          el.dataset.ready = ""
        }
      }
      place(false)
      // Base UI marks the active tab with data-active; follow it.
      const mo = new MutationObserver(() => place(true))
      mo.observe(el, { subtree: true, attributes: true, attributeFilter: ["data-active"] })
      // Labels change width with the language and the viewport: re-measure.
      const ro = new ResizeObserver(() => place(false))
      ro.observe(el)
      return () => {
        mo.disconnect()
        ro.disconnect()
      }
    },
    []
  )

  return (
    <TabsPrimitive.List
      ref={list}
      data-slot="tabs-list"
      className={cn("group/tabs-list relative inline-flex w-max items-center gap-1", className)}
      {...props}
    >
      <span
        ref={indicator}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-ink opacity-0 group-data-ready/tabs-list:opacity-100"
      />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 type-button-md whitespace-nowrap text-charcoal transition-colors duration-200 outline-none select-none",
        "hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:text-mute",
        // Active: light text over the indicator; its own pill only until the indicator is ready.
        "data-active:bg-ink data-active:text-on-dark data-active:hover:bg-ink group-data-ready/tabs-list:data-active:bg-transparent group-data-ready/tabs-list:data-active:hover:bg-transparent",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
