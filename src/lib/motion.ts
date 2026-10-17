// Shared GSAP setup. Motion here only explains a change (something arrived,
// moved or left); it never delays an action, and it is skipped entirely for
// people who ask their system to reduce motion.
//
// GSAP is not part of the first download. It loads once the visitor first
// moves, scrolls, taps or types, which is well before any change worth
// animating. Until then (and if it never loads) things simply appear in place.

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
  if (loaded) loaded.gsap.set(el, to)
  else {
    el.style.transform = `translateX(${to.x}px)`
    el.style.width = `${to.width}px`
  }
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
}
