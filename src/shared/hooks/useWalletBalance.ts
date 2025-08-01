import {useWebLNProvider} from "./useWebLNProvider"
import {useWalletStore} from "@/stores/wallet"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useEffect, useRef} from "react"

export const useWalletBalance = () => {
  const {balance, setBalance, provider, setProvider} = useWalletStore()
  const webLNProvider = useWebLNProvider()
  const {activeProvider, activeProviderType, activeNWCId} = useWalletProviderStore()
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Use activeProvider from wallet provider store, fallback to webLNProvider for backward compatibility
    const currentProvider = activeProvider || webLNProvider
    setProvider(currentProvider)
    
    // Clear balance when wallet is disabled
    if (activeProviderType === "disabled") {
      setBalance(null)
    }
  }, [activeProvider, webLNProvider, activeProviderType, setProvider, setBalance])

  // Listen for bitcoin-connect payment events that might affect balance
  useEffect(() => {
    const handlePayment = () => {
      // Refresh balance after a payment with multiple attempts
      if (provider && typeof provider.getBalance === "function") {
        const refreshBalance = async () => {
          try {
            const balanceInfo = await provider.getBalance()
            setBalance(balanceInfo.balance)
          } catch (error) {
            console.warn("Failed to refresh balance after payment:", error)
          }
        }

        // Immediate refresh
        setTimeout(refreshBalance, 500)
        // Second attempt after 2 seconds
        setTimeout(refreshBalance, 2000)
        // Third attempt after 5 seconds to catch slower settlements
        setTimeout(refreshBalance, 5000)
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

    // Use activeProvider for balance fetching, ensuring we react to wallet changes
    const currentProvider = activeProvider || provider
    
    if (currentProvider && typeof currentProvider.getBalance === "function" && activeProviderType !== "disabled") {
      const updateBalance = async () => {
        try {
          const balanceInfo = await currentProvider.getBalance()
          setBalance(balanceInfo.balance)
          return true
        } catch (error) {
          console.warn("Failed to get balance:", error)
          return false
        }
      }

      // Try to get balance with infinite retries and reasonable backoff
      const tryUpdateBalance = async (attempt = 1) => {
        const success = await updateBalance()

        if (!success) {
          // Retry with exponential backoff, capped at 30 seconds
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000)
          console.log(`Balance check failed, retrying in ${delay}ms (attempt ${attempt})`)
          retryTimeoutRef.current = setTimeout(() => {
            tryUpdateBalance(attempt + 1)
          }, delay)
        }
      }

      // Initial attempt with a delay to let wallet initialize
      retryTimeoutRef.current = setTimeout(() => {
        tryUpdateBalance()
      }, 2000)

      // Set up more frequent polling (every 30 seconds) for better responsiveness
      pollIntervalRef.current = setInterval(updateBalance, 30000)

      // Listen for provider events if supported
      if (currentProvider.on) {
        currentProvider.on("accountChanged", updateBalance)
        
        // Listen for invoice-related events that might indicate balance changes
        currentProvider.on("invoice_paid", updateBalance)
        currentProvider.on("payment_received", updateBalance)
        currentProvider.on("balance_changed", updateBalance)
        
        return () => {
          currentProvider.off?.("accountChanged", updateBalance)
          currentProvider.off?.("invoice_paid", updateBalance)
          currentProvider.off?.("payment_received", updateBalance)
          currentProvider.off?.("balance_changed", updateBalance)
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
  }, [activeProvider, provider, activeProviderType, activeNWCId, setBalance])

  return {balance}
}
