import {RiLayoutColumnLine, RiLayoutLeft2Line} from "@remixicon/react"
import {useSettingsStore} from "@/stores/settings"

interface ColumnLayoutToggleProps {
  showLabel?: boolean
  compact?: boolean
}

export function ColumnLayoutToggle({showLabel = false, compact = false}: ColumnLayoutToggleProps) {
  const {appearance, updateAppearance} = useSettingsStore()

  if (compact) {
    return (
      <button
        className="btn btn-circle btn-ghost"
        onClick={() => updateAppearance({singleColumnLayout: !appearance.singleColumnLayout})}
        title={
          appearance.singleColumnLayout ? "Two-column layout" : "Single-column layout"
        }
      >
        {appearance.singleColumnLayout ? (
          <RiLayoutColumnLine className="w-5 h-5" />
        ) : (
          <RiLayoutLeft2Line className="w-5 h-5" />
        )}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {showLabel && <span className="text-sm opacity-60">Layout</span>}
      <div className="rounded-lg bg-base-300 p-1 shadow-inner">
        <div className="relative flex items-center justify-around">
          <div
            className="py-1 w-10 z-10 cursor-pointer flex flex-col items-center"
            onClick={() => updateAppearance({singleColumnLayout: false})}
            title="Two-column layout"
          >
            <RiLayoutColumnLine
              className={`w-4 h-4 ${appearance.singleColumnLayout ? "opacity-50" : ""}`}
            />
          </div>
          <div
            className="py-1 w-10 z-10 cursor-pointer flex flex-col items-center"
            onClick={() => updateAppearance({singleColumnLayout: true})}
            title="Single-column layout"
          >
            <RiLayoutLeft2Line
              className={`w-4 h-4 ${!appearance.singleColumnLayout ? "opacity-50" : ""}`}
            />
          </div>
          <div
            className={`rounded-md absolute top-0 left-0 inset-0 w-1/2 h-full transition-transform shadow-sm bg-base-100 ${
              !appearance.singleColumnLayout ? "translate-x-0" : "translate-x-full"
            }`}
          />
        </div>
      </div>
    </div>
  )
}
