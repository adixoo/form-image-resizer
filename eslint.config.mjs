import js from "@eslint/js"
import { defineConfig, globalIgnores } from "eslint/config"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

export default defineConfig([
  globalIgnores([
    "dist/**",
    ".astro/**",
    // pdf.js runtime copied from node_modules (scripts/copy-pdfjs.mjs)
    "public/pdfjs/**",
    // Installed agent skills (npx skills add …), not app code
    ".claude/**",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
])
