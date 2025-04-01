import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {WebLNProvider} from "@/types/global"
import {useState, useEffect} from "react"

export const useWalletBalance = () => {
  const [isWalletConnect] = useLocalState("user/walletConnect", false)
  const [balance, setBalance] = useState<number | null>(null)
  const [webLnEnabled, setWebLnEnabled] = useState(false)
  const [provider, setProvider] = useState<WebLNProvider | null>(null)

  useEffect(() => {
    const setupProvider = async () => {
      if (isWalletConnect) {
        const {onConnected} = await import("@getalby/bitcoin-connect")
        onConnected(async (walletProvider) => {
          if (walletProvider) {
            setProvider(walletProvider)
          }
        })
      } else if (webLnEnabled && window.webln) {
        setProvider(window.webln)
      } else {
        setProvider(null)
      }
    }
    setupProvider()
  }, [isWalletConnect, webLnEnabled])

  useEffect(() => {
    window?.webln?.isEnabled().then(setWebLnEnabled)
  }, [])

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

  return {balance, isWalletConnect, webLnEnabled}
}
