import {useWalletStore} from "@/stores/wallet"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useEffect, useRef} from "react"
import {getCashuManager} from "@/lib/cashu/manager"

export const useWalletBalance = () => {
  const {balance, setBalance} = useWalletStore()
  const {activeProviderType, activeNWCId, nwcConnections} = useWalletProviderStore()
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear any existing intervals
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    const updateBalance = async () => {
      try {
        // No wallet selected
        if (activeProviderType === "disabled" || activeProviderType === undefined) {
          setBalance(null)
          return
        }

        // Cashu wallet
        if (activeProviderType === "cashu") {
          const manager = getCashuManager()
          if (!manager) {
            setBalance(null)
            return
          }

          const balances = await manager.wallet.getBalances()
          const totalBalance = Object.values(balances).reduce((sum, val) => sum + val, 0)
          setBalance(totalBalance)
          return
        }

        // NWC wallet
        if (activeProviderType === "nwc" && activeNWCId) {
          const connection = nwcConnections.find((c) => c.id === activeNWCId)
          if (connection?.balance !== undefined) {
            setBalance(connection.balance)
          } else {
            setBalance(null)
          }
          return
        }

        // Native WebLN - most don't support balance
        if (activeProviderType === "native") {
          setBalance(null)
          return
        }

        setBalance(null)
      } catch (error) {
        console.warn("Failed to get wallet balance:", error)
        setBalance(null)
      }
    }

    // Initial update
    updateBalance()

    // Listen to Cashu events for real-time updates
    if (activeProviderType === "cashu") {
      const manager = getCashuManager()
      if (manager) {
        const unsubscribers = [
          manager.on("melt-quote:paid", () => updateBalance()),
          manager.on("send:created", () => updateBalance()),
          manager.on("receive:created", () => updateBalance()),
          manager.on("mint-quote:redeemed", () => updateBalance()),
        ]

        // Still poll every 30 seconds as backup
        pollIntervalRef.current = setInterval(updateBalance, 30000)

        return () => {
          unsubscribers.forEach((unsub) => unsub())
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
          }
        }
      }
    }

    // Poll every 30 seconds for non-Cashu wallets
    pollIntervalRef.current = setInterval(updateBalance, 30000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [setBalance, activeProviderType, activeNWCId, nwcConnections])

  return {balance}
}
