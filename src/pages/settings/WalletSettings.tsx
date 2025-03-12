import {useLocalState} from "irisdb-hooks/src/useLocalState"
import {ChangeEvent, useState, useEffect} from "react"

const WalletSettings = () => {
  const [isWalletConnect, setIsWalletConnect] = useLocalState("user/walletConnect", false)
  const [balance, setBalance] = useState<number | null>(null)
  const [cashuEnabled, setCashuEnabled] = useLocalState("user/cashuEnabled", false)

  const [defaultZapAmount, setDefaultZapAmount] = useLocalState(
    "user/defaultZapAmount",
    21
  )

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

  const handleConnectWalletClick = async () => {
    const {init, requestProvider} = await import("@getalby/bitcoin-connect-react")
    init({
      appName: "Iris",
      filters: ["nwc"],
      showBalance: false,
    })
    const provider = await requestProvider()
    if (provider) setIsWalletConnect(true)
  }

  const handleDisconnectWalletClick = async () => {
    const {disconnect} = await import("@getalby/bitcoin-connect-react")
    disconnect()
    setIsWalletConnect(false)
  }

  const handleDefaultZapAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === "0" || !event.target.value) {
      setDefaultZapAmount(0)
      return
    }
    try {
      const numberAmount = Number(event?.target.value)
      setDefaultZapAmount(numberAmount)
    } catch {
      // ignore
    }
  }

  return (
    <div className="mb-4 prose">
      <h2>Wallet Settings</h2>
      <div className="flex flex-col gap-4">
        <h3>Cashu Wallet</h3>
        <div>
          <button
            className={`btn ${cashuEnabled ? "btn-error" : "btn-primary"}`}
            onClick={() => setCashuEnabled(!cashuEnabled)}
          >
            {cashuEnabled ? "Disable" : "Enable"} Cashu Wallet
          </button>
        </div>
      </div>
      <h3>Nostr Wallet Connect</h3>
      <div className="py-2 flex flex-col gap-4">
        {!isWalletConnect ? (
          <div>
            <button className="btn btn-primary" onClick={handleConnectWalletClick}>
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {balance !== null && <p>Balance: {balance} sats</p>}
            <button className="btn btn-primary" onClick={handleDisconnectWalletClick}>
              Disconnect Wallet
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <h3>Zaps</h3>
        <p>Default zap amount (sats)</p>
        <div>
          <input
            type="number"
            className="input input-primary"
            onChange={handleDefaultZapAmountChange}
            value={defaultZapAmount}
            placeholder="Default zap amount (sats)"
          />
        </div>
      </div>
    </div>
  )
}

export default WalletSettings
