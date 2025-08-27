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
    console.log("🔍 useWalletBalance effect triggered:", {
      activeProviderType,
      activeNWCId,
      hasActiveWallet: !!activeWallet,
      walletType: activeWallet?.constructor?.name,
      currentBalance: balance,
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

    // Only clear balance when explicitly disabled
    if (activeProviderType === "disabled") {
      console.log("🔍 Wallet disabled, clearing balance")
      setBalance(null)
      return
    }

    // If wallet isn't ready yet, just return without clearing balance
    if (activeProviderType === undefined || !activeWallet) {
      console.log("🔍 Wallet not ready yet, keeping existing balance")
      return
    }

    const updateBalance = async () => {
      try {
        console.log("🔍 useWalletBalance: calling getBalance()")
        const newBalance = await getBalance()
        console.log("🔍 useWalletBalance: getBalance returned:", newBalance)

        // Only update balance if we got a valid number
        // Never set to null or undefined - keep existing balance
        if (typeof newBalance === "number") {
          setBalance(newBalance)
        } else {
          console.log(
            "🔍 Keeping existing balance:",
            balance,
            "because new value is:",
            newBalance
          )
        }
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

      if (!success && attempt < 5) {
        // Retry with backoff: 2s, 3s, 4.5s, 6.75s
        const delay = Math.min(2000 * Math.pow(1.5, attempt - 1), 10000)
        console.log(`Balance check failed, retrying in ${delay}ms (attempt ${attempt})`)
        retryTimeoutRef.current = setTimeout(() => {
          tryUpdateBalance(attempt + 1)
        }, delay)
      }
    }

    // Initial attempt immediately, then retry with backoff if needed
    tryUpdateBalance()

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
