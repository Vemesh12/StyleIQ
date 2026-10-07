import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "excellent" | "good" | "acceptable" | "avoid" | "outline"
  }
>(({ className, variant = "default", ...props }, ref) => {
  const variantClasses = {
    default: "bg-amber-100 text-amber-800 border-amber-200",
    excellent: "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
    good: "bg-blue-100 text-blue-800 border-blue-200 font-semibold",
    acceptable: "bg-yellow-100 text-yellow-800 border-yellow-300",
    avoid: "bg-red-100 text-red-800 border-red-200 font-semibold",
    outline: "bg-slate-100 text-slate-700 border-slate-300",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors shadow-2xs",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }
