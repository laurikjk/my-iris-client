import {RiVipCrownFill, RiStarFill, RiDiamondFill} from "@remixicon/react"

export type SubscriptionTier = "patron" | "champion" | "vanguard"

export const getSubscriptionIcon = (
  tier: SubscriptionTier | undefined,
  className = "text-warning",
  size?: number
) => {
  const iconProps = {
    className,
    ...(size ? {size} : {}),
  }

  switch (tier) {
    case "patron":
      return <RiStarFill {...iconProps} />
    case "champion":
      return <RiVipCrownFill {...iconProps} />
    case "vanguard":
      return <RiDiamondFill {...iconProps} />
    default:
      return <RiVipCrownFill {...iconProps} />
  }
}
