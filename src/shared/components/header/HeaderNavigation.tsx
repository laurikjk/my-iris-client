import {MouseEvent} from "react"
import {RiArrowLeftLine} from "@remixicon/react"
import {useNavigate} from "@/navigation"

interface HeaderNavigationProps {
  showBack: boolean
  isLargeScreen: boolean
}

export const HeaderNavigation = ({showBack, isLargeScreen}: HeaderNavigationProps) => {
  const navigate = useNavigate()

  const handleBack = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate("/")
    }
  }

  if (!showBack || isLargeScreen) return null

  return (
    <button
      onClick={handleBack}
      className="flex items-center justify-center text-foreground p-2 hover:bg-accent rounded-lg transition-colors"
      aria-label="Go back"
    >
      <RiArrowLeftLine className="w-6 h-6" />
    </button>
  )
}
