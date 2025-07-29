import {
  useCallback,
  useRef,
  useState,
  RefObject,
  TouchEvent,
  MouseEvent,
  TransitionEvent,
} from "react"

export interface SwipeItem {
  id: string
  url: string
  type: "image" | "video"
  imeta?: string[]
}

export interface UseSwipableOptions {
  items: SwipeItem[]
  initialIndex?: number
  threshold?: number
  onIndexChange?: (index: number) => void
}

export interface UseSwipableReturn {
  currentIndex: number
  dragX: number
  isDragging: boolean
  isTransitioning: boolean
  transitionDirection: "none" | "prev" | "next"
  containerRef: RefObject<HTMLDivElement | null>
  wasDragged: RefObject<boolean>
  handlers: {
    onDragStart: (e: TouchEvent | MouseEvent) => void
    onDragMove: (e: TouchEvent | MouseEvent) => void
    onDragEnd: () => void
    onTransitionEnd: (e?: TransitionEvent<HTMLDivElement>) => void
  }
  navigation: {
    goToPrev: () => void
    goToNext: () => void
    goToIndex: (index: number) => void
    getPrevIndex: () => number
    getNextIndex: () => number
  }
  getTransform: () => string
}

export function useSwipable({
  items,
  initialIndex = 0,
  threshold = 0.5,
  onIndexChange,
}: UseSwipableOptions): UseSwipableReturn {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [transitionDirection, setTransitionDirection] = useState<
    "none" | "prev" | "next"
  >("none")

  const dragStartX = useRef<number | null>(null)
  const dragLastX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const wasDragged = useRef(false)

  // Helper to get prev/next indices (wrap around)
  const getPrevIndex = useCallback(
    () => (currentIndex - 1 + items.length) % items.length,
    [currentIndex, items.length]
  )

  const getNextIndex = useCallback(
    () => (currentIndex + 1) % items.length,
    [currentIndex, items.length]
  )

  // Navigation functions
  const goToNext = useCallback(() => {
    if (isTransitioning) return
    const nextIndex = getNextIndex()
    setCurrentIndex(nextIndex)
    onIndexChange?.(nextIndex)
  }, [getNextIndex, isTransitioning, onIndexChange])

  const goToPrev = useCallback(() => {
    if (isTransitioning) return
    const prevIndex = getPrevIndex()
    setCurrentIndex(prevIndex)
    onIndexChange?.(prevIndex)
  }, [getPrevIndex, isTransitioning, onIndexChange])

  const goToIndex = useCallback(
    (index: number) => {
      if (isTransitioning || index === currentIndex) return
      setCurrentIndex(index)
      onIndexChange?.(index)
    },
    [currentIndex, isTransitioning, onIndexChange]
  )

  // Mouse/touch handlers
  const onDragStart = useCallback((e: TouchEvent | MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    wasDragged.current = false
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    dragStartX.current = clientX
    dragLastX.current = clientX
  }, [])

  const onDragMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (!isDragging || dragStartX.current === null) return

      // Only preventDefault for mouse events, not touch events
      if (!("touches" in e)) {
        e.preventDefault()
      }

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const newDragX = clientX - dragStartX.current

      // Mark as dragged if moved more than a few pixels
      if (Math.abs(newDragX) > 5) {
        wasDragged.current = true
      }

      setDragX(newDragX)
      dragLastX.current = clientX
    },
    [isDragging]
  )

  const onDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth
    const currentThreshold = containerWidth * threshold

    setIsTransitioning(true)

    if (Math.abs(dragX) > currentThreshold) {
      const dir = dragX > 0 ? "prev" : "next"
      setTransitionDirection(dir)
      setTargetIndex(dir === "prev" ? getPrevIndex() : getNextIndex())
    } else {
      // Snap back
      setTransitionDirection("none")
      setTargetIndex(null)
    }
  }, [isDragging, dragX, threshold, getPrevIndex, getNextIndex])

  const handleTransitionEnd = useCallback(
    (e?: TransitionEvent<HTMLDivElement>) => {
      if (e && e.propertyName && e.propertyName !== "transform") return
      if (!isTransitioning) return

      const committed = targetIndex !== null && targetIndex !== currentIndex

      // Temporarily disable transitions before changing styles
      if (containerRef.current) {
        containerRef.current.style.transition = "none"
      }

      if (committed) {
        setCurrentIndex(targetIndex as number)
        onIndexChange?.(targetIndex as number)
      }

      setDragX(0)
      setIsTransitioning(false)
      setTransitionDirection("none")
      setTargetIndex(null)
      dragStartX.current = null
      dragLastX.current = null

      // Re-enable transitions after a brief delay
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transition = ""
        }
      }, 50)
    },
    [isTransitioning, targetIndex, currentIndex, onIndexChange]
  )

  const getTransform = useCallback(() => {
    // Base position is the middle slide (-100%). While dragging add pixel offset.
    let finalTransform = `translateX(calc(-100% + ${dragX}px))`

    if (isTransitioning) {
      // Drive end-state solely from direction. Never infer from indices.
      if (transitionDirection === "none") {
        finalTransform = `translateX(-100%)` // snap back
      } else if (transitionDirection === "prev") {
        finalTransform = `translateX(0%)` // show previous (left slide)
      } else {
        finalTransform = `translateX(-200%)` // show next (right slide)
      }
    }

    return finalTransform
  }, [dragX, isTransitioning, transitionDirection])

  return {
    currentIndex,
    dragX,
    isDragging,
    isTransitioning,
    transitionDirection,
    containerRef,
    wasDragged,
    handlers: {
      onDragStart,
      onDragMove,
      onDragEnd,
      onTransitionEnd: handleTransitionEnd,
    },
    navigation: {
      goToPrev,
      goToNext,
      goToIndex,
      getPrevIndex,
      getNextIndex,
    },
    getTransform,
  }
}
