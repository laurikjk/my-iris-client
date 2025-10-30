import {ReactNode, useCallback, useEffect, useRef} from "react"

type Props = {
  onLoadMore: () => void
  children: ReactNode
  enabled?: boolean
}

/**
 * Reverse virtual scroll for chat-like interfaces.
 * Places observer at top and triggers onLoadMore when scrolling up.
 * Preserves scroll position when prepending content.
 */
const ReverseVirtualScroll = ({onLoadMore, children, enabled = true}: Props) => {
  const observerRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const prevScrollHeightRef = useRef(0)
  const isLoadingRef = useRef(false)

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0]
      if (target.isIntersecting && enabled && !isLoadingRef.current) {
        isLoadingRef.current = true

        // Store scroll state before loading
        if (containerRef.current) {
          prevScrollHeightRef.current = containerRef.current.scrollHeight
        }

        onLoadMore()

        // Allow loading again after a short delay
        setTimeout(() => {
          isLoadingRef.current = false
        }, 100)
      }
    },
    [onLoadMore, enabled]
  )

  useEffect(() => {
    if (!observerRef.current) return

    // Find scroll container
    let element = observerRef.current.parentElement
    while (element) {
      const computedStyle = getComputedStyle(element)
      const overflowY = computedStyle.overflowY
      if (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        element.hasAttribute("data-header-scroll-target")
      ) {
        containerRef.current = element
        break
      }
      element = element.parentElement
    }

    const observerOptions = {
      root: containerRef.current,
      rootMargin: "500px 0px 0px 0px",
      threshold: 0.1,
    }

    const observer = new IntersectionObserver(handleObserver, observerOptions)
    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current)
      }
    }
  }, [handleObserver, enabled])

  // Preserve scroll position after content prepended
  useEffect(() => {
    if (containerRef.current && prevScrollHeightRef.current > 0) {
      const currentScrollHeight = containerRef.current.scrollHeight
      const heightDiff = currentScrollHeight - prevScrollHeightRef.current

      if (heightDiff > 0) {
        // Adjust scroll position to maintain visual position
        containerRef.current.scrollTop = containerRef.current.scrollTop + heightDiff
      }

      prevScrollHeightRef.current = 0
    }
  })

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <>
      <div ref={observerRef} style={{height: 1}} />
      {children}
    </>
  )
}

export default ReverseVirtualScroll
