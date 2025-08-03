import {useRef, useState, MouseEvent, TouchEvent} from "react"
import {useScrollDirection} from "./useScrollDirection"

interface UseScrollAwareLongPressOptions {
  onLongPress: () => void
  delay?: number
  movementThreshold?: number
}

interface UseScrollAwareLongPressReturn {
  handleMouseDown: (e: MouseEvent | TouchEvent) => void
  handleMouseMove: (e: MouseEvent | TouchEvent) => void
  handleMouseUp: () => void
  isLongPress: boolean
}

export function useScrollAwareLongPress({
  onLongPress,
  delay = 500,
  movementThreshold = 15,
}: UseScrollAwareLongPressOptions): UseScrollAwareLongPressReturn {
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startPosition = useRef<{x: number; y: number} | null>(null)
  const [isLongPress, setIsLongPress] = useState(false)
  const {
    detectDirection,
    getCurrentDirection,
    reset: resetScrollDirection,
  } = useScrollDirection()

  const handleMouseDown = (e: MouseEvent | TouchEvent) => {
    setIsLongPress(false)
    resetScrollDirection()

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    startPosition.current = {x: clientX, y: clientY}

    longPressTimeout.current = setTimeout(() => {
      // Only trigger long press if we haven't detected scrolling
      if (getCurrentDirection() === "none") {
        setIsLongPress(true)
        onLongPress()
      }
    }, delay)
  }

  const handleMouseMove = (e: MouseEvent | TouchEvent) => {
    if (!startPosition.current) return

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    const deltaX = clientX - startPosition.current.x
    const deltaY = clientY - startPosition.current.y

    // Only cancel if movement is significant enough (tolerates micro-movements)
    const totalMovement = Math.abs(deltaX) + Math.abs(deltaY)
    if (totalMovement > movementThreshold) {
      // Detect scroll direction - if vertical scrolling is detected, cancel long press
      const direction = detectDirection(deltaX, deltaY)
      if (direction === "vertical" && longPressTimeout.current) {
        clearTimeout(longPressTimeout.current)
        longPressTimeout.current = undefined
      }
    }
  }

  const handleMouseUp = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current)
    }
    startPosition.current = null
    resetScrollDirection()
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isLongPress,
  }
}
