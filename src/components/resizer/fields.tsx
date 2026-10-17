import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint && <p className="-mt-1 type-body-sm text-body">{hint}</p>}
      {children}
      {error && <p className="type-body-sm text-danger">{error}</p>}
    </div>
  )
}

/**
 * Label beside its control on one line (stacked on narrow phones). Rows in a
 * card share the same label width so their controls line up.
 */
export function Row({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-x-5">
      {/* pt aligns the label with the middle of a 40–44px control */}
      <Label htmlFor={htmlFor} className="leading-snug text-charcoal sm:pt-3">
        {label}
      </Label>
      {children}
      {(hint || error) && (
        <div className="flex flex-col gap-1 sm:col-start-2">
          {hint && <p className="type-body-sm text-body">{hint}</p>}
          {error && <p className="type-body-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}

/** Pill input with a fixed "KB" suffix. */
export function KBInput({
  id,
  placeholder,
  value,
  invalid,
  onChange,
  className,
  autoFocus,
}: {
  id: string
  placeholder: string
  value: string
  invalid?: boolean
  onChange: (v: string) => void
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        aria-invalid={invalid}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="pr-12"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center type-body-sm tabular-nums text-mute">
        KB
      </span>
    </div>
  )
}
