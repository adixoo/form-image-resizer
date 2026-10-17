
import { useRef, useState } from "react"
import { ImageUp, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export const IMAGE_TYPES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
export const PDF_TYPES = "application/pdf,.pdf"

/** Dashed drop target that also opens the file picker on tap. */
export function FileDrop({
  accept,
  multiple,
  title,
  hint,
  icon: Icon = ImageUp,
  onFiles,
  className,
}: {
  accept: string
  multiple?: boolean
  title: string
  hint?: string
  icon?: LucideIcon
  onFiles: (files: File[]) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-hairline-strong bg-canvas px-6 py-10 text-center transition-colors outline-none",
        "hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/50",
        dragging && "border-ink bg-surface-soft",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-soft">
        <Icon className="size-5 text-ink" strokeWidth={1.75} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="type-body-strong text-ink">{title}</span>
        {hint && <span className="type-body-sm text-body">{hint}</span>}
      </span>
      <FileInput ref={inputRef} accept={accept} multiple={multiple} onFiles={onFiles} />
    </button>
  )
}

/**
 * Hidden file input, opened by a visible button ("Add", "Change", the drop
 * area). It is fully hidden rather than visually hidden: the button is what
 * people and screen readers use, so the input needs no label of its own.
 */
export function FileInput({
  ref,
  accept,
  multiple,
  onFiles,
}: {
  ref: React.Ref<HTMLInputElement>
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
}) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      hidden
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const files = [...(e.target.files ?? [])]
        if (files.length) onFiles(files)
        e.target.value = ""
      }}
    />
  )
}
