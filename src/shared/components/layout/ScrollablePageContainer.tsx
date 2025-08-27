import {ReactNode} from "react"
import classNames from "classnames"

interface ScrollablePageContainerProps {
  children: ReactNode
  className?: string
  /**
   * Whether to add padding for mobile header (default: true)
   */
  withHeaderPadding?: boolean
}

/**
 * Reusable scrollable container that handles:
 * - Mobile header/footer padding
 * - Scroll behavior
 * - Header scroll target marking
 * - Consistent styling
 */
export function ScrollablePageContainer({
  children,
  className = "",
  withHeaderPadding = true,
}: ScrollablePageContainerProps) {
  return (
    <div
      className={classNames(
        "flex-1 w-full max-w-full overflow-y-scroll overflow-x-hidden scrollbar-hide relative",
        className
      )}
      data-main-scroll-container="true"
      data-header-scroll-target
    >
      <div
        className={classNames("w-full max-w-full", {
          "pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0": withHeaderPadding,
        })}
      >
        {children}
        <div className="h-44 md:hidden" aria-hidden="true" />
      </div>
    </div>
  )
}
