// Shared GSAP setup. Motion here only explains a change (something arrived,
// moved or left); it never delays an action, and it is skipped entirely for
// people who ask their system to reduce motion.

import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import { Flip } from "gsap/Flip"

gsap.registerPlugin(useGSAP, Flip)

export { Flip, gsap, useGSAP }

export const EASE_OUT = "power3.out"
export const EASE_POP = "back.out(1.7)"

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
