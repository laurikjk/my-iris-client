import {Link} from "@/navigation"
import {MouseEvent} from "react"

interface CategoryLabelProps {
  category: string
  isActive?: boolean
  maxLength?: number
  className?: string
  onClick?: (e: MouseEvent) => void
  userCount?: number
}

export function CategoryLabel({
  category,
  isActive = false,
  maxLength = 20,
  className = "",
  onClick,
  userCount,
}: CategoryLabelProps) {
  const truncatedCategory =
    category.length > maxLength ? category.substring(0, maxLength) + "..." : category

  // If onClick is provided, use a button instead of Link to prevent double navigation
  if (onClick) {
    return (
      <button
        className={`badge cursor-pointer transition-colors ${
          isActive
            ? "badge-primary"
            : "badge-outline hover:bg-primary/10 hover:border-primary"
        } ${className}`}
        onClick={onClick}
        title={category.length > maxLength ? category : undefined}
      >
        {truncatedCategory}
        {userCount !== undefined && userCount > 0 && (
          <span className="ml-1 opacity-60 text-xs">({userCount})</span>
        )}
      </button>
    )
  }

  return (
    <Link
      to={`/m/${encodeURIComponent(category)}`}
      className={`badge cursor-pointer transition-colors ${
        isActive
          ? "badge-primary"
          : "badge-outline hover:bg-primary/10 hover:border-primary"
      } ${className}`}
      title={category.length > maxLength ? category : undefined}
    >
      {truncatedCategory}
      {userCount !== undefined && userCount > 0 && (
        <span className="ml-1 opacity-60 text-xs">({userCount})</span>
      )}
    </Link>
  )
}
