import {SettingsGroupItem} from "./SettingsGroupItem"

interface SettingsButtonProps {
  label: string
  onClick: () => void
  variant?: "default" | "destructive" | "warning"
  isLast?: boolean
  disabled?: boolean
}

export function SettingsButton({
  label,
  onClick,
  variant = "default",
  isLast = false,
  disabled = false,
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
      <span className={getTextColor()}>{label}</span>
    </SettingsGroupItem>
  )
}
