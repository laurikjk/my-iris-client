import {useWalletStore} from "@/stores/wallet"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useEffect, useRef} from "react"

export const useWalletBalance = () => {
  const {balance, setBalance} = useWalletStore()
  const {activeWallet, activeProviderType, activeNWCId, getBalance} =
    useWalletProviderStore()
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    console.log("🔍 useWalletBalance state:", {
      activeProviderType,
      activeNWCId,
      hasActiveWallet: !!activeWallet,
    })

    // Clear any existing intervals/timeouts
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    // Clear balance immediately when wallet is disabled or uninitialized
    if (
      activeProviderType === "disabled" ||
      activeProviderType === undefined ||
      !activeWallet
    ) {
      console.log("🔍 No active wallet, clearing balance")
      setBalance(null)
      return
    }

    const updateBalance = async () => {
      try {
        const balance = await getBalance()
        setBalance(balance)
        return true
      } catch (error) {
        // Don't spam console with expected balance request failures
        if (error instanceof Error && !error.message.includes("rate-limited")) {
          console.warn("Failed to get balance:", error)
        }
        return false
      }
    }

    // Try to get balance with less frequent retries
    const tryUpdateBalance = async (attempt = 1) => {
      const success = await updateBalance()

      if (!success) {
        // Retry with slower backoff, starting at 5 seconds, capped at 30 seconds
        const delay = Math.min(5000 * Math.pow(1.5, attempt - 1), 30000)
        console.log(`Balance check failed, retrying in ${delay}ms (attempt ${attempt})`)
        retryTimeoutRef.current = setTimeout(() => {
          tryUpdateBalance(attempt + 1)
        }, delay)
      }
    }

    // Initial attempt with a longer delay to let wallet initialize
    retryTimeoutRef.current = setTimeout(() => {
      tryUpdateBalance()
    }, 5000)

    // Set up more frequent polling (every 30 seconds) for better responsiveness
    pollIntervalRef.current = setInterval(updateBalance, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [activeWallet, activeProviderType, activeNWCId, setBalance, getBalance])

  return {balance}
}
