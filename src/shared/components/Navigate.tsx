import {MouseEvent, ReactNode} from "react"
import {useNavigate} from "react-router"
import classNames from "classnames"

interface NavigateProps {
  to: string
  children: ReactNode
  className?: string
  stopPropagation?: boolean
  onClick?: (e: MouseEvent) => void
}

export function Navigate({
  to,
  children,
  className,
  stopPropagation = true,
  onClick,
}: NavigateProps) {
  const navigate = useNavigate()

  const handleClick = (e: MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation()
    }

    if (onClick) {
      onClick(e)
    }

    try {
      navigate(to)
    } catch (error) {
      console.warn("Navigation error:", error)
    }
  }

  return (
    <span className={classNames("cursor-pointer", className)} onClick={handleClick}>
      {children}
    </span>
  )
}
