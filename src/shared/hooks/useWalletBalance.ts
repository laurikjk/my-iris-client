import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {useNWCProvider} from "./useNWCProvider"
import {WebLNProvider} from "@/types/global"
import {useState, useEffect} from "react"

export const useWalletBalance = () => {
  const [isWalletConnect] = useLocalState("user/walletConnect", false)
  const [balance, setBalance] = useState<number | null>(null)
  const nwcProvider = useNWCProvider()
  const [provider, setProvider] = useState<WebLNProvider | null>(null)

  useEffect(() => {
    setProvider(nwcProvider)
  }, [nwcProvider])

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
