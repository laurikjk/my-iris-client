import {ReactNode} from "react"

interface SettingsGroupProps {
  title?: string
  children: ReactNode
}

export function SettingsGroup({title, children}: SettingsGroupProps) {
  return (
    <div>
      {title && (
        <h2 className="font-semibold text-sm text-base-content/70 uppercase tracking-wide mb-3 px-3">
          {title}
        </h2>
      )}
      <div className="bg-base-100 rounded-xl overflow-hidden shadow-sm">{children}</div>
    </div>
  )
}
