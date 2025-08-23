import {ReactNode} from "react"
import classNames from "classnames"

interface ScrollablePageContainerProps {
  children: ReactNode
  className?: string
  /**
   * Whether to add padding for mobile header (default: true)
   */
  withHeaderPadding?: boolean
  /**
   * Whether to add padding for mobile footer (default: true)
   */
  withFooterPadding?: boolean
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
  withFooterPadding = true,
}: ScrollablePageContainerProps) {
  return (
    <div
      className={classNames(
        "flex-1 w-full max-w-full overflow-y-scroll overflow-x-hidden scrollbar-hide",
        {
          "pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0": withHeaderPadding,
          "pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0": withFooterPadding,
        },
        className
      )}
      data-main-scroll-container="true"
      data-header-scroll-target
    >
      {children}
    </div>
  )
}
