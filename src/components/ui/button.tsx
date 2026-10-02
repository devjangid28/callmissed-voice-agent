import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const variants = {
  variant: {
    default:
      "bg-primary text-primary-foreground shadow-soft hover:brightness-110 active:scale-[0.98]",
    destructive:
      "bg-destructive text-destructive-foreground shadow-soft hover:brightness-110 active:scale-[0.98]",
    outline:
      "border border-border/70 bg-card/60 text-foreground shadow-soft hover:border-border hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
    ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  },
  size: {
    default: "h-10 px-4",
    sm: "h-9 rounded-lg px-3 text-[13px]",
    xs: "h-8 rounded-lg px-2.5 text-xs [&_svg]:size-3.5",
    lg: "h-12 rounded-2xl px-7 text-[15px]",
    icon: "h-10 w-10",
    "icon-sm": "h-8 w-8 rounded-lg",
  },
} as const

/**
 * Derived from the same object handed to `cva` so the prop unions and the
 * generated classes can never drift apart.
 */
type ButtonVariant = keyof typeof variants.variant
type ButtonSize = keyof typeof variants.size

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium",
    // 150–250ms ease-out on every interactive state; no flashy motion.
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out-expo",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants,
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        // Buttons inside forms default to `submit`, which has caused
        // accidental submissions in this UI before.
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
export type { ButtonSize, ButtonVariant }
