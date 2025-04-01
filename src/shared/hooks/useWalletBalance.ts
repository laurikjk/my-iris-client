import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {useState, useEffect} from "react"

export const useWalletBalance = () => {
  const [isWalletConnect] = useLocalState("user/walletConnect", false)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const getBalance = async () => {
      if (isWalletConnect) {
        const {onConnected} = await import("@getalby/bitcoin-connect")
        const unsub = onConnected(async (provider) => {
          if (provider) {
            const balanceInfo = await provider.getBalance()
            setBalance(balanceInfo.balance)
          }
        })
        return () => unsub()
      }
    }
    getBalance()
  }, [isWalletConnect])

  return {balance, isWalletConnect}
}
