import {RiVipCrownFill, RiStarFill, RiDiamondFill} from "@remixicon/react"

export type SubscriptionTier = "supporter" | "premium" | "ultra"

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
    case "supporter":
      return <RiStarFill {...iconProps} />
    case "premium":
      return <RiVipCrownFill {...iconProps} />
    case "ultra":
      return <RiDiamondFill {...iconProps} />
    default:
      return <RiVipCrownFill {...iconProps} />
  }
}
