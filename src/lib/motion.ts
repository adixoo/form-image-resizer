// Shared GSAP setup. Motion here only explains a change (something arrived,
// moved or left); it never delays an action, and it is skipped entirely for
// people who ask their system to reduce motion.
//
// GSAP is not part of the first download. It loads once the page is idle, or
// sooner if the visitor moves, scrolls, taps or types. Sliding indicators
// wait for it (a few milliseconds at most); other animations are skipped
// until it is in.

import type { gsap as GsapCore } from "gsap"
import type { Flip as FlipPlugin } from "gsap/Flip"

export type Gsap = typeof GsapCore
export type Flip = typeof FlipPlugin
export type FlipState = ReturnType<Flip["getState"]>

export const EASE_OUT = "power3.out"
export const EASE_POP = "back.out(1.7)"

let loaded: { gsap: Gsap; Flip: Flip } | null = null
let loading: Promise<{ gsap: Gsap; Flip: Flip }> | null = null

export function loadMotion() {
  loading ??= Promise.all([import("gsap"), import("gsap/Flip")]).then(([{ gsap }, { Flip }]) => {
    gsap.registerPlugin(Flip)
    loaded = { gsap, Flip }
    return loaded
  })
  return loading
}

/** GSAP and Flip once they have loaded, otherwise null: skip the animation. */
export function motion() {
  return loaded
}

/** Move a sliding indicator without animating it, with or without GSAP. */
export function placeAt(el: HTMLElement, to: { x: number; width: number }) {
  // Once GSAP is in, it must make every move so it knows where things are.
  if (loaded) loaded.gsap.set(el, { ...to, overwrite: true })
  else {
    el.style.transform = `translateX(${to.x}px)`
    el.style.width = `${to.width}px`
  }
}

/**
 * Slide an indicator to a new spot. If GSAP is still on its way, the
 * indicator stays put until it arrives and then slides, so the first tap
 * animates like every other one.
 */
export function slideTo(el: HTMLElement, to: { x: number; width: number }, duration: number) {
  if (reducedMotion()) return placeAt(el, to)
  const run = ({ gsap }: { gsap: Gsap }) =>
    gsap.to(el, { ...to, duration, ease: EASE_OUT, overwrite: true })
  if (loaded) run(loaded)
  else loadMotion().then(run, () => placeAt(el, to))
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

if (typeof window !== "undefined" && !reducedMotion()) {
  const events = ["pointermove", "pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const
  const start = () => {
    events.forEach((e) => window.removeEventListener(e, start))
    void loadMotion()
  }
  events.forEach((e) => window.addEventListener(e, start, { passive: true }))
  whenIdle(start)
}

/** After the page has loaded and the browser has nothing more urgent to do. */
export function whenIdle(task: () => void) {
  const schedule = () =>
    "requestIdleCallback" in window ? requestIdleCallback(task, { timeout: 3000 }) : setTimeout(task, 1500)
  if (document.readyState === "complete") schedule()
  else window.addEventListener("load", schedule, { once: true })
}
