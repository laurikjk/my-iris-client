import {useSubscriptionStatus} from "@/shared/hooks/useSubscriptionStatus"
import {RiVipCrownFill} from "@remixicon/react"

interface SubscriberBadgeProps {
  className?: string
  pubkey?: string
}

export function SubscriberBadge({className = "", pubkey}: SubscriberBadgeProps) {
  const {isSubscriber, isLoading} = useSubscriptionStatus(pubkey)

  if (isLoading || !isSubscriber) return null

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <RiVipCrownFill className="text-warning" />
      <span className="text-xs font-medium text-warning">Subscriber</span>
    </div>
  )
}
