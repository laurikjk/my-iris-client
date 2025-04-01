import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {useWebLNProvider} from "./useWebLNProvider"
import {WebLNProvider} from "@/types/global"
import {useState, useEffect} from "react"

export const useWalletBalance = () => {
  const [isWalletConnect] = useLocalState("user/walletConnect", false)
  const [balance, setBalance] = useState<number | null>(null)
  const webLNProvider = useWebLNProvider()
  const [provider, setProvider] = useState<WebLNProvider | null>(null)

  useEffect(() => {
    setProvider(webLNProvider)
  }, [webLNProvider])

  useEffect(() => {
    if (provider) {
      const updateBalance = async () => {
        const balanceInfo = await provider.getBalance()
        setBalance(balanceInfo.balance)
      }
      updateBalance()

      if (provider.on) {
        provider.on("accountChanged", updateBalance)
        return () => {
          provider.off?.("accountChanged", updateBalance)
        }
      }
    } else {
      setBalance(null)
    }
  }, [provider])

  return {balance, isWalletConnect}
}
