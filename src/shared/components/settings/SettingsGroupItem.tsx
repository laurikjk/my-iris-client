import {ReactNode} from "react"

interface SettingsGroupItemProps {
  children: ReactNode
  isLast?: boolean
  onClick?: () => void
  className?: string
  variant?: "default" | "navigation"
}

export function SettingsGroupItem({
  children,
  isLast = false,
  onClick,
  className = "",
  variant = "default",
}: SettingsGroupItemProps) {
  const padding = variant === "navigation" ? "px-4 py-2" : "px-4 py-2.5"
  const baseClasses = `${padding} hover:bg-base-200/50 transition-colors relative`

  const borderElement = !isLast ? (
    <div className="absolute bottom-0 left-4 right-0 border-b-px border-base-content/15" />
  ) : null

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left ${baseClasses} ${className}`}
      >
        {children}
        {borderElement}
      </button>
    )
  }

  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
      {borderElement}
    </div>
  )
}
