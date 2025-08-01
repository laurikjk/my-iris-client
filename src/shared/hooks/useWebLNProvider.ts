import {useWalletProviderStore} from "@/stores/walletProvider"
import {WebLNProvider} from "@/types/global"
import {useEffect} from "react"

export const useWebLNProvider = (): WebLNProvider | null => {
  const {
    activeProvider,
    initializeProviders,
    refreshActiveProvider,
  } = useWalletProviderStore()

  useEffect(() => {
    // Initialize providers on mount
    initializeProviders()
  }, [initializeProviders])

  useEffect(() => {
    // Refresh active provider when it changes
    refreshActiveProvider()
  }, [refreshActiveProvider])

  return activeProvider
}
