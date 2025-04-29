import {useEffect, useState} from "react"

/**
 * Hook to check if a user is a subscriber based on their pubkey
 * @param pubkey The user's public key
 * @returns An object containing the subscription status and loading state
 */
export function useSubscriptionStatus(pubkey?: string) {
  const [isSubscriber, setIsSubscriber] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSubscriberStatus = async () => {
      if (!pubkey) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch the NIP-05 data to check for subscription_plan_id
        const response = await fetch(
          `https://iris.to/.well-known/nostr.json?pubkey=${pubkey}`
        )
        if (response.ok) {
          const data = await response.json()
          setIsSubscriber(!!data.subscription_plan_id)
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

  return {isSubscriber, isLoading}
} 