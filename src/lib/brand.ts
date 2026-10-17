// The site's name and the searches it should be found for. The brand itself
// is translated in messages (site.brand) but stays "FormSeva" in every
// language, so these English aliases apply everywhere.

export const BRAND = "FormSeva"

/** Other ways people write or search for the site (schema.org alternateName). */
export const BRAND_ALIASES = [
  "Form Seva",
  "FormSeva Image Resizer",
  "FormSeva Image Compressor",
  "Form Image Resizer",
  "Form Image Compressor",
]

/** <meta name="keywords">: ignored by Google, still read by some engines. */
export const KEYWORDS = [
  "formseva",
  "form seva",
  "formseva image compressor",
  "formseva image resizer",
  "form image compressor",
  "form image resizer",
  "photo resizer for govt forms",
  "signature resizer",
  "resize image to kb",
  "compress pdf to kb",
].join(", ")

/** A page title that ends with the brand ("Compress PDF … | FormSeva"). */
export function brandTitle(title: string): string {
  return title.includes(BRAND) ? title : `${title} | ${BRAND}`
}
