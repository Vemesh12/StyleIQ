import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * A clickable card that also works from the keyboard: focusable, activated
 * with Enter/Space, announces its selected state, and shows a focus ring.
 */
const SelectableCard = React.forwardRef<
  HTMLDivElement,
  Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> & {
    selected?: boolean
    onSelect: () => void
  }
>(({ className, selected, onSelect, onKeyDown, ...props }, ref) => (
  <Card
    ref={ref}
    role="button"
    tabIndex={0}
    aria-pressed={selected ?? false}
    onClick={onSelect}
    onKeyDown={(e) => {
      onKeyDown?.(e)
      if (e.defaultPrevented || e.target !== e.currentTarget) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        onSelect()
      }
    }}
    className={cn(
      "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
      className
    )}
    {...props}
  />
))
SelectableCard.displayName = "SelectableCard"

export { SelectableCard }
