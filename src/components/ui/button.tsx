import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding type-button-md whitespace-nowrap transition-[color,background-color,border-color,transform] duration-200 ease-out outline-none select-none active:not-disabled:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:border-transparent disabled:bg-surface-soft disabled:text-mute aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // button-primary: the universal black pill
        default: "bg-primary text-primary-foreground hover:bg-ink/85 active:bg-ink-deep",
        // button-secondary: outline pill on the light canvas
        outline:
          "border-hairline-strong bg-canvas text-ink hover:bg-surface-soft aria-expanded:bg-surface-soft",
        // soft gray pill (chips, command tags)
        secondary: "bg-surface-soft text-ink hover:bg-hairline/70 aria-expanded:bg-surface-soft",
        ghost: "text-ink hover:bg-surface-soft aria-expanded:bg-surface-soft",
        // button-pill-on-dark: white pill inside the inverted surface
        inverse: "bg-canvas text-ink hover:bg-canvas/90 active:bg-surface-soft",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/15",
        link: "text-ink underline underline-offset-4",
      },
      size: {
        default:
          "h-9 gap-1.5 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 px-3 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
