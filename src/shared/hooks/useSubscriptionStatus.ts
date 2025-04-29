import {useEffect, useState} from "react"

/**
 * Hook to check if a user is a subscriber based on their pubkey
 * @param pubkey The user's public key
 * @returns An object containing the subscription status, loading state, and tier
 */
export function useSubscriptionStatus(pubkey?: string) {
  const [isSubscriber, setIsSubscriber] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [tier, setTier] = useState<"supporter" | "premium" | "ultra" | undefined>(
    undefined
  )

  useEffect(() => {
    const checkSubscriberStatus = async () => {
      if (!pubkey) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch the user data to check for subscription status
        const response = await fetch(
          `${CONFIG.defaultSettings.irisApiUrl}/user/find?public_key=${pubkey}`
        )
        if (response.ok) {
          const data = await response.json()
          const hasSubscription = !!data.subscription_plan
          setIsSubscriber(hasSubscription)

          // Set the tier based on the subscription plan
          if (hasSubscription) {
            // The plan name comes directly from the database
            const planName = data.subscription_plan.toLowerCase()
            if (planName.includes("ultra")) {
              setTier("ultra")
            } else if (planName.includes("premium")) {
              setTier("premium")
            } else {
              setTier("supporter")
            }
          } else {
            setTier(undefined)
          }
        }
      } catch (error) {
        console.error("Error checking subscriber status:", error)
      } finally {
        setIsLoading(false)
      }
    }

    setIsLoading(true)
    checkSubscriberStatus()
  }, [pubkey])

  return {isSubscriber, isLoading, tier}
}
