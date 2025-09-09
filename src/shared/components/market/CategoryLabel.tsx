import {Link} from "@/navigation"
import {MouseEvent} from "react"

interface CategoryLabelProps {
  category: string
  isActive?: boolean
  maxLength?: number
  className?: string
  onClick?: (e: MouseEvent) => void
}

export function CategoryLabel({
  category,
  isActive = false,
  maxLength = 20,
  className = "",
  onClick,
}: CategoryLabelProps) {
  const truncatedCategory =
    category.length > maxLength ? category.substring(0, maxLength) + "..." : category

  return (
    <Link
      to={`/m/${encodeURIComponent(category)}`}
      className={`badge cursor-pointer transition-colors ${
        isActive
          ? "badge-primary"
          : "badge-outline hover:bg-primary/10 hover:border-primary"
      } ${className}`}
      onClick={onClick}
      title={category.length > maxLength ? category : undefined}
    >
      {truncatedCategory}
    </Link>
  )
}
