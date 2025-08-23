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
  /**
   * Additional content to render at the bottom (before the spacer)
   */
  bottomContent?: ReactNode
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
  bottomContent,
}: ScrollablePageContainerProps) {
  return (
    <div
      className={classNames(
        "flex-1 w-full max-w-full overflow-y-scroll overflow-x-hidden scrollbar-hide",
        {
          "pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0": withHeaderPadding,
        },
        className
      )}
      data-main-scroll-container="true"
      data-header-scroll-target
    >
      {children}
      {bottomContent}
      {/* Spacer for mobile footer */}
      {withFooterPadding && (
        <div className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />
      )}
    </div>
  )
}
