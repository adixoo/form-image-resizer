/**
 * Errors meant for the user. They carry a code instead of English text so the
 * UI can show them in the selected language (messages → errors.<code>).
 */
export type ErrorCode =
  | "unknown"
  | "notImage"
  | "decode"
  | "canvas"
  | "encode"
  | "minOverMax"
  | "fixedTooBig"
  | "tooBig"
  | "tooBigPng"
  | "notPdf"
  | "pdfEncrypted"
  | "pdfBroken"
  | "pdfTooBig"
  | "noCards"

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public params?: Record<string, string | number>
  ) {
    super(code)
  }
}

export function toAppError(err: unknown): AppError {
  return err instanceof AppError ? err : new AppError("unknown")
}
