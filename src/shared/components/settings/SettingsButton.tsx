import {SettingsGroupItem} from "./SettingsGroupItem"
import {ReactNode} from "react"

interface SettingsButtonProps {
  label: string
  onClick: () => void
  variant?: "default" | "destructive" | "warning"
  isLast?: boolean
  disabled?: boolean
  info?: ReactNode
}

export function SettingsButton({
  label,
  onClick,
  variant = "default",
  isLast = false,
  disabled = false,
  info,
}: SettingsButtonProps) {
  const getTextColor = () => {
    if (disabled) return "text-base-content/40"

    switch (variant) {
      case "destructive":
        return "text-error"
      case "warning":
        return "text-warning"
      default:
        return "text-info"
    }
  }

  return (
    <SettingsGroupItem onClick={disabled ? undefined : onClick} isLast={isLast}>
      {info ? (
        <div className="flex flex-col space-y-2">
          <span className={getTextColor()}>{label}</span>
          <div className="text-sm text-base-content/60">{info}</div>
        </div>
      ) : (
        <span className={getTextColor()}>{label}</span>
      )}
    </SettingsGroupItem>
  )
}
