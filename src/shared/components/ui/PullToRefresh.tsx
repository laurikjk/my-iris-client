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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const ostrichRef = useRef<HTMLImageElement>(null)
  const startY = useRef(0)
  const isPulling = useRef(false)
  const currentPullDistance = useRef(0)

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
        currentPullDistance.current = 0
        if (contentRef.current) {
          contentRef.current.style.transform = "translate3d(0, 0, 0)"
        }
        if (indicatorRef.current) {
          indicatorRef.current.style.height = "0px"
          indicatorRef.current.style.display = "none"
        }
        return
      }

      const currentY = e.touches[0].clientY
      const diff = currentY - startY.current

      if (diff > 0) {
        e.preventDefault()
        const resistance = 0.5
        const actualDistance = Math.min(diff * resistance, threshold * 1.5)
        currentPullDistance.current = actualDistance

        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(0, ${actualDistance}px, 0)`
        }
        if (indicatorRef.current) {
          indicatorRef.current.style.display = "flex"
          indicatorRef.current.style.height = `${actualDistance}px`
        }
        if (ostrichRef.current) {
          const opacity = Math.min(actualDistance / threshold, 1)
          ostrichRef.current.style.opacity = `${opacity}`
        }
      }
    },
    [threshold]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isPulling.current) return

    isPulling.current = false

    if (currentPullDistance.current >= threshold && !isRefreshing) {
      setIsRefreshing(true)

      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${threshold}px, 0)`
      }
      if (indicatorRef.current) {
        indicatorRef.current.style.height = `${threshold}px`
      }

      // Delay the refresh callback to allow animation to complete smoothly
      requestAnimationFrame(() => {
        setTimeout(() => {
          onRefresh()
        }, 100)
      })

      setTimeout(() => {
        setIsRefreshing(false)
        currentPullDistance.current = 0
        if (contentRef.current) {
          contentRef.current.style.transform = "translate3d(0, 0, 0)"
        }
        if (indicatorRef.current) {
          indicatorRef.current.style.height = "0px"
          indicatorRef.current.style.display = "none"
        }
      }, 1000)
    } else {
      currentPullDistance.current = 0
      if (contentRef.current) {
        contentRef.current.style.transform = "translate3d(0, 0, 0)"
      }
      if (indicatorRef.current) {
        indicatorRef.current.style.height = "0px"
        indicatorRef.current.style.display = "none"
      }
    }
  }, [threshold, isRefreshing, onRefresh])

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

  return (
    <div ref={containerRef} className="relative h-full overflow-hidden">
      <div
        ref={indicatorRef}
        className="absolute top-0 left-0 right-0 justify-center items-center pointer-events-none z-50 will-change-transform"
        style={{
          display: "none",
          height: "0px",
        }}
      >
        <img
          ref={ostrichRef}
          src={ostrichGif}
          alt="Loading..."
          className="w-12 h-12"
          style={{
            opacity: 0,
          }}
        />
      </div>
      <div
        ref={contentRef}
        className="will-change-transform"
        style={{
          transform: "translate3d(0, 0, 0)",
        }}
      >
        {children}
      </div>
    </div>
  )
}
