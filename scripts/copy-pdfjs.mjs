// Copies pdf.js runtime assets (worker, standard fonts, CMaps, WASM decoders) into
// public/ so they are served from our own origin, as the CSP requires.
import { copyFileSync, cpSync, mkdirSync } from "node:fs"

const src = "node_modules/pdfjs-dist"
const dest = "public/pdfjs"
mkdirSync(dest, { recursive: true })
for (const dir of ["standard_fonts", "cmaps", "wasm"]) {
  cpSync(`${src}/${dir}`, `${dest}/${dir}`, { recursive: true })
}
// The parser runs in its own worker, loaded from our origin.
copyFileSync(`${src}/build/pdf.worker.min.mjs`, `${dest}/pdf.worker.min.mjs`)
