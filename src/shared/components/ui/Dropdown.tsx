import {ReactNode, useEffect} from "react"
import classNames from "classnames"

type DropdownProps = {
  children: ReactNode
  onClose: () => void
  position?: {
    clientY?: number
    alignRight?: boolean
  }
}

function Dropdown({children, onClose, position}: DropdownProps) {
  // Calculate direction immediately based on position prop
  const getDirection = () => {
    if (position?.clientY && typeof window !== "undefined") {
      return position.clientY < window.innerHeight / 2 ? "down" : "up"
    }
    return "down"
  }

  const direction = getDirection()

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    const onClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".dropdown-container")) {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", onEscape)
    window.addEventListener("click", onClickOutside, {capture: true})

    return () => {
      window.removeEventListener("keydown", onEscape)
      window.removeEventListener("click", onClickOutside, {capture: true})
    }
  }, [onClose])

  const getPositionClasses = () => {
    const baseClasses = "dropdown dropdown-open dropdown-container z-50"
    const alignClass = position?.alignRight ? "dropdown-end" : "dropdown-left"
    const directionClass = direction === "up" ? "dropdown-top" : "dropdown-bottom"

    return classNames(baseClasses, alignClass, directionClass)
  }

  return <div className={getPositionClasses()}>{children}</div>
}

export default Dropdown
