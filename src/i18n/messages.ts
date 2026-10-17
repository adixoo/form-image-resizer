import { createTranslator } from "use-intl/core"

import en from "../../messages/en.json"
import { DEFAULT_LOCALE, type Locale } from "./routing"

export type Messages = typeof en

const catalogs = import.meta.glob<{ default: Messages }>("../../messages/*.json", { eager: true })

type Tree = { [key: string]: string | Tree }

function deepMerge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = out[k]
    out[k] = typeof v === "object" && typeof b === "object" ? deepMerge(b, v) : v
  }
  return out
}

/** A language's messages, with English filling any key that isn't translated yet. */
export function getMessages(locale: Locale): Messages {
  const own = catalogs[`../../messages/${locale}.json`]?.default
  if (!own || locale === DEFAULT_LOCALE) return en
  return deepMerge(en as Tree, own as Tree) as Messages
}

/** Translator for .astro files (React islands use useTranslations instead). */
export function getTranslator(locale: Locale) {
  return createTranslator({ locale, messages: getMessages(locale) })
}
