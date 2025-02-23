import {useState, useRef, useEffect} from "react"

export function useHoverCard(showHoverCard: boolean) {
  const [isOpen, setIsOpen] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const closeCard = () => {
    setIsOpen(false)
  }

  const hoverProps = showHoverCard
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
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return {hoverProps, showCard: showHoverCard && isOpen, closeCard}
}
