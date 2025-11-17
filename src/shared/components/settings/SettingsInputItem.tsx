import {ReactNode} from "react"

interface SettingsInputItemProps {
  label: string
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  isLast?: boolean
  rightContent?: ReactNode
  type?: "text" | "email" | "url"
  multiline?: boolean
  description?: string
}

export function SettingsInputItem({
  label,
  value = "",
  placeholder,
  onChange,
  isLast = false,
  rightContent,
  type = "text",
  multiline = false,
  description,
}: SettingsInputItemProps) {
  const inputClasses =
    "bg-transparent border-none p-0 text-base focus:outline-none placeholder:text-base-content/40 flex-1 min-w-0 text-right"

  return (
    <div className="px-4 py-3 hover:bg-base-200/50 transition-colors relative">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1 flex-shrink-0">
          <label className="text-base font-normal">{label}</label>
          {description && (
            <span className="text-sm text-base-content/60">{description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          {multiline ? (
            <textarea
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange?.(e.target.value)}
              className={`${inputClasses.replace("text-right", "text-left")} resize-none min-h-[1.5em]`}
              rows={1}
            />
          ) : (
            <input
              type={type}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange?.(e.target.value)}
              className={inputClasses}
            />
          )}
          {rightContent}
        </div>
      </div>
      {!isLast && (
        <div className="absolute bottom-0 left-4 right-0 border-b-px border-base-content/15" />
      )}
    </div>
  )
}
