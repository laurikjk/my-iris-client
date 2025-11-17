import {useEffect, useState, useCallback} from "react"

// Hardcoded subscriber data (synced 2025-11-17)
const HARDCODED_SUBSCRIBERS = new Map<
  string,
  {tier: "patron" | "champion"; endDate: string}
>([
  [
    "e2bab35b5296ec2242ded0a01f6d6723a5cd921239280c0a5f0b5589303336b6",
    {tier: "patron", endDate: "2025-11-29T22:43:00Z"},
  ],
  [
    "040ab8ad2ab2447f2a702903553eb56820a6799a3edc4a6d3816e0cc41fea7f8",
    {tier: "patron", endDate: "2025-12-21T13:35:00Z"},
  ],
  [
    "1faee0e854e848af26060f6ad40d278d882bb8b8f1c474b25e2f95c7fee1ac9d",
    {tier: "patron", endDate: "2025-12-29T15:46:00Z"},
  ],
  [
    "df410c7a4dac30eec2437d39911e1cf812f3f6aae3f628da40e3190b582db9dc",
    {tier: "patron", endDate: "2026-06-09T23:09:00Z"},
  ],
  [
    "4408b61d584b7a48373d1b2f05bc30fed614f316da272b984b4d587522470502",
    {tier: "patron", endDate: "2026-07-12T11:44:00Z"},
  ],
  [
    "6eef2e68c399c8f2efbf70d831c2b618d7a84bdfd21734a81e6d7d3d817f6850",
    {tier: "patron", endDate: "2026-07-15T15:27:00Z"},
  ],
  [
    "0ab915c92977c66b57c6bf64d58252db46e5d027ad2c7e1aac9aa3b4bc2ae379",
    {tier: "champion", endDate: "2026-08-21T19:29:00Z"},
  ],
  [
    "2f372b6c2d615a91c9248f87417525dc202dfbb37ffea5cd2f182d7fc1ef514a",
    {tier: "patron", endDate: "2026-09-13T08:23:00Z"},
  ],
  [
    "65f13e7c23321cb09909ef08da71c6d9bc44f390a92783e78b930609ab370ac9",
    {tier: "patron", endDate: "2026-10-24T06:31:00Z"},
  ],
  [
    "4523be58d395b1b196a9b8c82b038b6895cb02b683d0c253a955068dba1facd0",
    {tier: "patron", endDate: "2028-05-28T06:54:00Z"},
  ],
])

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

  const checkSubscriberStatus = useCallback(() => {
    if (!pubkey) {
      setIsLoading(false)
      return
    }

    const hardcoded = HARDCODED_SUBSCRIBERS.get(pubkey)
    if (hardcoded) {
      const now = new Date()
      const end = new Date(hardcoded.endDate)
      const isActive = end >= now

      setIsSubscriber(isActive)
      setTier(isActive ? hardcoded.tier : undefined)
      setEndDate(hardcoded.endDate)
    } else {
      setIsSubscriber(false)
      setTier(undefined)
      setEndDate(undefined)
    }

    setIsLoading(false)
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
