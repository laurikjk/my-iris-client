import {ReactNode} from "react"

interface WidgetProps {
  title?: string | null | false
  children: ReactNode
  background?: boolean
}

function Widget({title, children, background = true}: WidgetProps) {
  return (
    <div className={background ? "bg-base-100 rounded-lg" : ""}>
      {title && (
        <h2 className="font-bold text-xs text-base-content/50 uppercase tracking-wide px-4 py-3">
          {title}
        </h2>
      )}
      <div className="h-96 overflow-y-auto px-4 py-1">{children}</div>
    </div>
  )
}

export default Widget
