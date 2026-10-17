
import { TriangleAlert } from "lucide-react"
import { useTranslations } from "use-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { AppError } from "@/lib/errors"

/** Shows an AppError in the current language. */
export function ErrorAlert({ error, title }: { error: AppError | null; title?: string }) {
  const t = useTranslations()
  if (!error) return null
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>{title ?? t("common.failed")}</AlertTitle>
      <AlertDescription>{t(`errors.${error.code}`, error.params)}</AlertDescription>
    </Alert>
  )
}
