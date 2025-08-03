import SearchBox from "@/shared/components/ui/SearchBox.tsx"
import {useState, useEffect, ReactNode} from "react"
import {RiArrowLeftSLine, RiArrowRightSLine} from "@remixicon/react"
import {useSettingsStore} from "@/stores/settings"
import ErrorBoundary from "./ui/ErrorBoundary"

interface RightColumnProps {
  children: () => ReactNode
}

function useWindowWidth() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return windowWidth
}

function RightColumn({children}: RightColumnProps) {
  const windowWidth = useWindowWidth()
  const {appearance, updateAppearance} = useSettingsStore()
  const isExpanded = appearance.showRightColumn

  const isTestEnvironment =
    typeof window !== "undefined" && window.location.href.includes("localhost:5173")

  if (windowWidth < 1024 && !isTestEnvironment) {
    return null
  }

  // Collapsed state - just show toggle arrow
  if (!isExpanded) {
    return (
      <div
        className="hidden lg:block fixed top-3 z-50"
        style={{
          right: Math.max(16, (windowWidth - 1280) / 2 + 16), // 16px from max-w-screen-xl edge (1280px)
        }}
      >
        <button
          onClick={() => updateAppearance({showRightColumn: true})}
          className="bg-base-100 border border-base-300 p-2 rounded-full shadow-lg hover:bg-base-200 transition-colors"
          title="Show right column"
        >
          <RiArrowLeftSLine className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="px-4 py-4 h-screen overflow-y-auto scrollbar-hide sticky top-0 flex flex-col gap-4 w-1/3 hidden lg:flex border-l border-custom">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBox searchNotes={true} />
          </div>
          <button
            onClick={() => updateAppearance({showRightColumn: false})}
            className="p-2 hover:bg-base-200 rounded-lg transition-colors flex-shrink-0"
            title="Hide right column"
          >
            <RiArrowRightSLine className="w-5 h-5" />
          </button>
        </div>
        {children()}
      </div>
    </ErrorBoundary>
  )
}

export default RightColumn
