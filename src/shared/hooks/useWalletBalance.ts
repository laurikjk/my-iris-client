import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {useState, useEffect} from "react"

export const useWalletBalance = () => {
  const [isWalletConnect] = useLocalState("user/walletConnect", false)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const getBalance = async () => {
      if (isWalletConnect) {
        const {requestProvider} = await import("@getalby/bitcoin-connect-react")
        const provider = await requestProvider()
        if (provider) {
          const balanceInfo = await provider.getBalance()
          setBalance(balanceInfo.balance)
        }
      }
    }
    getBalance()
  }, [isWalletConnect])

  return {balance, isWalletConnect}
}
