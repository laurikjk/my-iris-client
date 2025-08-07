import {ReactNode, useRef, useState, useEffect, useCallback} from "react"
import ostrichGif from "@/assets/running-ostrich.gif"

interface PullToRefreshProps {
  onRefresh: () => void
  children: ReactNode
  threshold?: number
}

export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const isPulling = useRef(false)
  const rafId = useRef<number>()

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const scrollEl = containerRef.current?.querySelector(
      "[data-scrollable]"
    ) as HTMLElement
    if (scrollEl && scrollEl.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current) return

      const scrollEl = containerRef.current?.querySelector(
        "[data-scrollable]"
      ) as HTMLElement
      if (!scrollEl || scrollEl.scrollTop > 0) {
        isPulling.current = false
        setPullDistance(0)
        return
      }

      const currentY = e.touches[0].clientY
      const diff = currentY - startY.current

      if (diff > 0) {
        e.preventDefault()

        // Cancel any pending RAF
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
        }

        // Schedule update on next frame
        rafId.current = requestAnimationFrame(() => {
          const resistance = 0.5
          const actualDistance = diff * resistance
          setPullDistance(Math.min(actualDistance, threshold * 1.5))
        })
      }
    },
    [threshold]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return

    isPulling.current = false

    // Cancel any pending RAF
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
    }

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      onRefresh()

      setTimeout(() => {
        setIsRefreshing(false)
        setPullDistance(0)
      }, 1000)
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("touchstart", handleTouchStart, {passive: true})
    container.addEventListener("touchmove", handleTouchMove, {passive: false})
    container.addEventListener("touchend", handleTouchEnd, {passive: true})

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const showIndicator = pullDistance > 0 || isRefreshing
  const opacity = Math.min(pullDistance / threshold, 1)

  return (
    <div ref={containerRef} className="relative h-full overflow-hidden">
      {showIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none z-50 will-change-transform"
          style={{
            height: `${isRefreshing ? threshold : pullDistance}px`,
            transition: isRefreshing ? "height 0.2s ease" : "none",
          }}
        >
          <img
            src={ostrichGif}
            alt="Loading..."
            className="w-12 h-12"
            style={{
              opacity,
              transition: isRefreshing ? "opacity 0.2s ease" : "none",
            }}
          />
        </div>
      )}
      <div
        className="will-change-transform"
        style={{
          transform: `translateZ(0) translateY(${isRefreshing ? threshold : pullDistance}px)`,
          transition: isRefreshing ? "transform 0.2s ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  )
}
