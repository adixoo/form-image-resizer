import { CircleCheck, Info, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The tool's settings card. The footer is a soft strip for the live status and
 * secondary actions, so it never competes with the controls above it.
 */
export function ToolCard({
  children,
  footer,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:p-8">{children}</div>
      {footer && (
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-soft px-6 py-3 sm:px-8">
          {footer}
        </div>
      )}
    </div>
  )
}

export type StatusState = "idle" | "working" | "done"

/** One line of live status with an icon that matches the state. */
export function ToolStatus({ state, children }: { state: StatusState; children: React.ReactNode }) {
  const Icon = state === "working" ? LoaderCircle : state === "done" ? CircleCheck : Info
  return (
    <p
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-2 type-body-sm",
        state === "idle" ? "text-body" : "text-ink"
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", state === "working" && "animate-spin")}
        strokeWidth={state === "done" ? 2 : 1.75}
      />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
