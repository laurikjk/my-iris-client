import {useLocalState} from "irisdb-hooks"
import {ChangeEvent} from "react"

const WalletSettings = () => {
  const [isWalletConnect, setIsWalletConnect] = useLocalState("user/walletConnect", false)

  const [defaultZapAmount, setDefaultZapAmount] = useLocalState(
    "user/defaultZapAmount",
    21
  )

  const handleConnectWalletClick = async () => {
    const {init, requestProvider} = await import("@getalby/bitcoin-connect-react")
    init({
      appName: "Nestr",
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
    <div className="mb-4">
      <h2 className="mb-4">Nostr Wallet Connect</h2>
      <div className="py-2 flex flex-col gap-4">
        {!isWalletConnect ? (
          <div>
            <button className="btn btn-primary" onClick={handleConnectWalletClick}>
              Connect Wallet
            </button>
          </div>
        ) : (
          <div>
            <button className="btn btn-primary" onClick={handleDisconnectWalletClick}>
              Disconnect Wallet
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4">
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
