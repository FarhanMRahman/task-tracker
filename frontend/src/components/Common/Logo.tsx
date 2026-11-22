import { Link } from "@tanstack/react-router"
import { ListChecks } from "lucide-react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

// Text + icon logo instead of image files: one component, crisp at any size,
// and it follows light/dark mode through the theme's colour tokens.
// Sizes are in em, so the logo scales with the font size passed in className.
function Mark() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-[1.4em] shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <ListChecks className="size-[0.9em]" />
    </span>
  )
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const name = (
    <span className="font-semibold tracking-tight">Task Tracker</span>
  )

  const content = (
    <span className={cn("inline-flex items-center gap-2 text-lg", className)}>
      <Mark />
      {variant === "full" && name}
      {variant === "icon" && <span className="sr-only">Task Tracker</span>}
      {variant === "responsive" && (
        // Hide the name when the sidebar collapses to icons only
        <span className="group-data-[collapsible=icon]:hidden">{name}</span>
      )}
    </span>
  )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
