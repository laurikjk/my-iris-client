import {useWalletProviderStore} from "@/stores/walletProvider"
import {NDKWallet} from "@nostr-dev-kit/ndk-wallet"
import {useEffect} from "react"

export const useWebLNProvider = (): NDKWallet | null => {
  const {activeWallet, initializeProviders, refreshActiveProvider} =
    useWalletProviderStore()

  useEffect(() => {
    console.log("🔍 useWebLNProvider: initializing providers")
    // Initialize providers on mount
    initializeProviders()
  }, [initializeProviders])

  useEffect(() => {
    console.log("🔍 useWebLNProvider: refreshing active provider")
    // Refresh active provider when it changes
    refreshActiveProvider()
  }, [refreshActiveProvider])

  return activeWallet
}
