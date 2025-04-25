import {RiVipCrownFill} from "@remixicon/react"

interface SubscriberBadgeProps {
  className?: string
}

export function SubscriberBadge({className = ""}: SubscriberBadgeProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <RiVipCrownFill className="text-warning" />
      <span className="text-xs font-medium text-warning">Subscriber</span>
    </div>
  )
}
