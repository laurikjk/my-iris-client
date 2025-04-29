import {useSubscriptionStatus} from "@/shared/hooks/useSubscriptionStatus"
import {getSubscriptionIcon} from "@/shared/utils/subscriptionIcons"
import {Link} from "react-router"

interface SubscriberBadgeProps {
  className?: string
  pubkey?: string
}

export function SubscriberBadge({className = "", pubkey}: SubscriberBadgeProps) {
  const {isSubscriber, isLoading, tier} = useSubscriptionStatus(pubkey)

  if (isLoading || !isSubscriber) return null

  const getBadgeText = () => {
    switch (tier) {
      case "supporter":
        return "Supporter"
      case "premium":
        return "Premium"
      case "ultra":
        return "Ultra"
      default:
        return "Subscriber"
    }
  }

  return (
    <Link to="/settings/subscription" className={`flex items-center gap-1 ${className}`}>
      {getSubscriptionIcon(tier)}
      <span className="text-xs font-medium text-warning">{getBadgeText()}</span>
    </Link>
  )
}
