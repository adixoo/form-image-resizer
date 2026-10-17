
import { useTranslations } from "use-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { AdvancedLabel } from "@/components/resizer/advanced"
import { Field, KBInput } from "@/components/resizer/fields"
import {
  advancedSummary,
  decimal,
  digits,
  type SettingErrors,
  type Settings,
} from "@/components/resizer/settings"

/** Rarely needed options live in a side panel so the main flow stays one screen. */
export function AdvancedSheet({
  settings,
  errors,
  onChange,
  defaultOpen,
  autoFocus,
}: {
  settings: Settings
  errors: SettingErrors
  onChange: (patch: Partial<Settings>) => void
  defaultOpen?: boolean
  autoFocus?: boolean
}) {
  const t = useTranslations("image.advanced")
  const tc = useTranslations("common")
  const tv = useTranslations("image.validation")
  const active = advancedSummary(settings)

  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger
        autoFocus={autoFocus}
        render={<Button variant="ghost" size="sm" className="-mr-3 shrink-0" />}
      >
        <AdvancedLabel count={active.length} />
      </SheetTrigger>
      {/* Don't auto-focus an input on touch: it would pop the keyboard over the panel. */}
      <SheetContent side="right" initialFocus={(openType) => openType !== "touch"}>
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <Field
            label={t("minSize")}
            htmlFor="minKB"
            hint={t("minHint")}
            error={errors.minKB && tv(errors.minKB)}
          >
            <KBInput
              id="minKB"
              placeholder={tc("optional")}
              value={settings.minKB}
              invalid={!!errors.minKB}
              onChange={(v) => onChange({ minKB: decimal(v) })}
            />
          </Field>

          <Field
            label={t("dims")}
            hint={t("dimsHint")}
            error={errors.dims && tv(errors.dims)}
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label={t("width")}
                inputMode="numeric"
                placeholder={t("width")}
                value={settings.width}
                aria-invalid={!!errors.dims}
                onChange={(e) => onChange({ width: digits(e.target.value) })}
              />
              <span className="type-body-sm text-mute">×</span>
              <Input
                aria-label={t("height")}
                inputMode="numeric"
                placeholder={t("height")}
                value={settings.height}
                aria-invalid={!!errors.dims}
                onChange={(e) => onChange({ height: digits(e.target.value) })}
              />
              <span className="type-body-sm tabular-nums text-mute">px</span>
            </div>
          </Field>

          {settings.kind === "signature" && (
            <SwitchRow
              id="clean"
              label={t("clean")}
              hint={t("cleanHint")}
              checked={settings.cleanSignature}
              onChange={(cleanSignature) => onChange({ cleanSignature })}
            />
          )}

          {settings.kind === "document" && (
            <SwitchRow
              id="cleanDoc"
              label={t("cleanDoc")}
              hint={t("cleanDocHint")}
              checked={settings.cleanDocument}
              onChange={(cleanDocument) => onChange({ cleanDocument })}
            />
          )}
        </div>

        <SheetFooter className="flex-row">
          <Button
            variant="outline"
            className="flex-1"
            disabled={active.length === 0}
            onClick={() =>
              onChange({
                minKB: "",
                width: "",
                height: "",
                cleanSignature: true,
                cleanDocument: false,
              })
            }
          >
            {tc("reset")}
          </Button>
          <SheetClose render={<Button className="flex-1" />}>{tc("done")}</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="type-body-sm text-body">{hint}</p>
      </div>
    </div>
  )
}
