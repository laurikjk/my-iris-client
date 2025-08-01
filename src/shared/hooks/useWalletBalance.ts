import {useWebLNProvider} from "./useWebLNProvider"
import {useWalletStore} from "@/stores/wallet"
import {useUserStore} from "@/stores/user"
import {useEffect, useRef} from "react"

export const useWalletBalance = () => {
  const isWalletConnect = useUserStore((state) => state.walletConnect)
  const {balance, setBalance, provider, setProvider} = useWalletStore()
  const webLNProvider = useWebLNProvider()
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setProvider(webLNProvider)
  }, [webLNProvider])

  // Listen for bitcoin-connect payment events that might affect balance
  useEffect(() => {
    const handlePayment = () => {
      // Refresh balance after a payment
      if (provider && typeof provider.getBalance === "function") {
        setTimeout(async () => {
          try {
            const balanceInfo = await provider.getBalance()
            setBalance(balanceInfo.balance)
          } catch (error) {
            console.warn("Failed to refresh balance after payment:", error)
          }
        }, 1000) // Small delay to let payment settle
      }
    }

    window.addEventListener("bc:onpaid", handlePayment)
    return () => {
      window.removeEventListener("bc:onpaid", handlePayment)
    }
  }, [provider])

  useEffect(() => {
    // Clear any existing intervals/timeouts
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    if (provider && typeof provider.getBalance === "function") {
      const updateBalance = async () => {
        try {
          const balanceInfo = await provider.getBalance()
          setBalance(balanceInfo.balance)
          return true
        } catch (error) {
          console.warn("Failed to get balance:", error)
          return false
        }
      }

      // Try to get balance with retries and delays
      const tryUpdateBalance = async (attempt = 1, maxAttempts = 3) => {
        const success = await updateBalance()

        if (!success && attempt < maxAttempts) {
          // Retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          retryTimeoutRef.current = setTimeout(() => {
            tryUpdateBalance(attempt + 1, maxAttempts)
          }, delay)
        } else if (!success) {
          // All retries failed, set balance to null
          setBalance(null)
        }
      }

      // Initial attempt with a delay to let wallet initialize
      retryTimeoutRef.current = setTimeout(() => {
        tryUpdateBalance()
      }, 2000)

      // Set up less frequent polling (every 2 minutes) since balance doesn't change often
      pollIntervalRef.current = setInterval(updateBalance, 120000)

      // Listen for account changes if supported
      if (provider.on) {
        provider.on("accountChanged", updateBalance)
        return () => {
          provider.off?.("accountChanged", updateBalance)
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
          }
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current)
          }
        }
      }

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }
      }
    } else {
      setBalance(null)
    }
  }, [provider])

  return {balance, isWalletConnect}
}
