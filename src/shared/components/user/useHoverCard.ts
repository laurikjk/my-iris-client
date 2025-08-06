import {useState, useRef, useEffect} from "react"
import {isTouchDevice} from "@/shared/utils/isTouchDevice"

export function useHoverCard(showHoverCard: boolean) {
  const [isOpen, setIsOpen] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const closeCard = () => {
    setIsOpen(false)
  }

  const hoverProps =
    showHoverCard && !isTouchDevice
      ? {
          onMouseEnter: () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => setIsOpen(true), 300)
          },
          onMouseLeave: () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            timeoutRef.current = setTimeout(() => setIsOpen(false), 300)
          },
        }
      : {}

  useEffect(() => {
    if (!showHoverCard || !isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        closeCard()
      }
    }

    // Add listener when card is open
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showHoverCard, isOpen])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return {hoverProps, showCard: showHoverCard && isOpen, closeCard, cardRef}
}
