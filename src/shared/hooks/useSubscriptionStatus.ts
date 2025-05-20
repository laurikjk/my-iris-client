import {useEffect, useState, useCallback} from "react"

/**
 * Hook to check if a user is a subscriber based on their pubkey
 * @param pubkey The user's public key
 * @returns An object containing the subscription status, loading state, tier, and refresh function
 */
export function useSubscriptionStatus(pubkey?: string) {
  const [isSubscriber, setIsSubscriber] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [tier, setTier] = useState<"patron" | "champion" | "vanguard" | undefined>(
    undefined
  )
  const [endDate, setEndDate] = useState<string | undefined>(undefined)
  const [refreshCounter, setRefreshCounter] = useState(0)

  const checkSubscriberStatus = useCallback(async () => {
    if (!pubkey) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      // Fetch the user data to check for subscription status
      const response = await fetch(
        `${CONFIG.defaultSettings.irisApiUrl}/user/find?public_key=${pubkey}`
      )
      if (response.ok) {
        const data = await response.json()
        const hasSubscription = !!data.subscription_plan
        setIsSubscriber(hasSubscription)
        setEndDate(data.subscription_end_date)

        // Set the tier based on the subscription plan
        if (hasSubscription) {
          // The plan name comes directly from the database
          const planName = data.subscription_plan.toLowerCase()
          if (planName.includes("vanguard")) {
            setTier("vanguard")
          } else if (planName.includes("champion")) {
            setTier("champion")
          } else {
            setTier("patron")
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
  }, [pubkey])

  const refresh = useCallback(() => {
    setRefreshCounter((c) => c + 1)
  }, [])

  useEffect(() => {
    checkSubscriberStatus()
  }, [checkSubscriberStatus, pubkey, refreshCounter])

  return {
    isSubscriber,
    isLoading,
    tier,
    endDate,
    refresh,
  }
}
