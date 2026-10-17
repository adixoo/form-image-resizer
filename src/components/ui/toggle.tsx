
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-full type-button-md whitespace-nowrap text-ink transition-[color,background-color,border-color,transform] duration-200 ease-out outline-none active:not-disabled:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 hover:bg-surface-soft focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:text-mute aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-ink/85 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-hairline-strong bg-canvas",
      },
      size: {
        default:
          "h-9 min-w-9 px-5",
        sm: "h-8 min-w-8 px-4 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 min-w-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
