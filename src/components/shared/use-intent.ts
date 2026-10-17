import { useState } from "react"

/**
 * How far someone has reached for a control that loads its code on demand:
 * pointed at it (load it), focused it (load it, then keep focus on it) or
 * pressed it (load it and open it straight away).
 */
export type Intent = "load" | "focus" | "open"

/**
 * For a lightweight stand-in shown until the real control's code arrives.
 * Spread `bind` on the stand-in; once `intent` is set, render the real control
 * (inside Suspense, with the stand-in as the fallback).
 */
export function useIntent(load: () => Promise<unknown>) {
  const [intent, setIntent] = useState<Intent | null>(null)
  const bind = {
    onPointerEnter: () => {
      void load()
      setIntent((i) => i ?? "load")
    },
    onFocus: () => {
      void load()
      setIntent((i) => (i === "open" ? i : "focus"))
    },
    onClick: () => {
      void load()
      setIntent("open")
    },
  }
  return [intent, bind] as const
}
