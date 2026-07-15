import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-slate-950 text-white shadow-sm hover:bg-slate-800",
        variant === "secondary" && "border border-border bg-white text-foreground shadow-sm hover:bg-muted",
        variant === "ghost" && "text-slate-700 hover:bg-muted",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className
      )}
      {...props}
    />
  )
}
