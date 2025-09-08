import {useState, useEffect, RefObject} from "react"

export interface KeyboardNavigationOptions<T = unknown> {
  inputRef: RefObject<HTMLInputElement | null>
  items: T[]
  onSelect: (index: number) => void
  onEscape?: () => void
  isActive?: boolean
}

export function useKeyboardNavigation<T>({
  inputRef,
  items,
  onSelect,
  onEscape,
  isActive = true,
}: KeyboardNavigationOptions<T>) {
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset active index when items change
  useEffect(() => {
    setActiveIndex(0)
  }, [items.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !isActive ||
        document.activeElement !== inputRef.current ||
        items.length === 0
      ) {
        return
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((prev) => (prev + 1) % items.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length)
      } else if (e.key === "Enter") {
        e.preventDefault()
        onSelect(activeIndex)
      } else if (e.key === "Escape") {
        e.preventDefault()
        onEscape?.()
        inputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeIndex, items.length, onSelect, onEscape, isActive])

  return {activeIndex, setActiveIndex}
}
