import {requestProvider} from "@getalby/bitcoin-connect"
import {useWalletBalance} from "@/shared/hooks/useWalletBalance"
import {useUserStore} from "@/stores/user"
import {useWalletProviderStore, WalletProviderType} from "@/stores/walletProvider"
import {ChangeEvent, useState} from "react"

const WalletSettings = () => {
  const {balance} = useWalletBalance()
  const {cashuEnabled, defaultZapAmount, setCashuEnabled, setDefaultZapAmount} =
    useUserStore()

  const {
    activeProviderType,
    activeNWCId,
    nativeProvider,
    nwcConnections,
    setActiveProviderType,
    setActiveNWCId,
    addNWCConnection,
    removeNWCConnection,
    connectToNWC,
  } = useWalletProviderStore()

  const [newNWCName, setNewNWCName] = useState("")
  const [newNWCConnection, setNewNWCConnection] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)

  const handleProviderTypeChange = (type: WalletProviderType) => {
    setActiveProviderType(type)
  }

  const handleNWCSelectionChange = (nwcId: string) => {
    setActiveProviderType("nwc")
    setActiveNWCId(nwcId)
    connectToNWC(nwcId)
  }

  const handleAddNWCConnection = async () => {
    if (!newNWCName.trim() || !newNWCConnection.trim()) return

    const id = addNWCConnection({
      name: newNWCName.trim(),
      connectionString: newNWCConnection.trim(),
    })

    setNewNWCName("")
    setNewNWCConnection("")

    // Auto-select the new connection
    setActiveProviderType("nwc")
    setActiveNWCId(id)

    setIsConnecting(true)
    try {
      await connectToNWC(id)
      // Close modal on success
      ;(document.getElementById("add-nwc-modal") as HTMLDialogElement)?.close()
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnectLegacyWallet = async () => {
    const {init} = await import("@getalby/bitcoin-connect-react")
    init({
      appName: "Iris",
      filters: ["nwc"],
      showBalance: false,
    })

    setIsConnecting(true)
    try {
      const provider = await requestProvider()
      if (provider) {
        // Add as a new NWC connection
        const id = addNWCConnection({
          name: `NWC Connection ${Date.now()}`,
          connectionString: "managed_by_bitcoin_connect",
          provider,
        })
        setActiveProviderType("nwc")
        setActiveNWCId(id)
      }
    } finally {
      setIsConnecting(false)
    }
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

  const getBalanceDisplay = () => {
    if (activeProviderType === "disabled") return "No wallet connected"
    if (balance !== null) return `${balance.toLocaleString()} sats`
    return "Loading..."
  }

  const getCurrentWalletDisplay = () => {
    console.log("📱 Getting current wallet display:", {
      activeProviderType,
      activeNWCId,
      nwcConnectionsCount: nwcConnections.length,
    })

    if (activeProviderType === "disabled") return "No wallet connected"
    if (activeProviderType === "native") return "Native WebLN"
    if (activeProviderType === "nwc" && activeNWCId) {
      const connection = nwcConnections.find((c) => c.id === activeNWCId)
      console.log("📱 Found NWC connection:", connection?.name)
      return connection ? connection.name : "Unknown NWC"
    }
    return "No wallet selected"
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Wallet Settings</h1>
        <div className="flex items-center gap-3 text-lg">
          <span className="text-gray-600">Balance:</span>
          <span className="font-semibold">{getBalanceDisplay()}</span>
        </div>
      </div>

      {/* Active Wallet Section */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4">Lightning Wallet</h2>

          {/* Current Wallet Display */}
          <div className="flex items-center justify-between p-4 bg-base-200 rounded-lg mb-4">
            <div>
              <span className="text-sm text-gray-500">Currently using:</span>
              <div className="font-semibold">{getCurrentWalletDisplay()}</div>
            </div>
            {balance !== null && balance > 0 && (
              <div className="badge badge-success">Connected</div>
            )}
          </div>

          {/* Wallet Selection Radio Buttons */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Select Wallet</span>
            </label>
            <div className="space-y-2">
              {/* No wallet option */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-base-50">
                <input
                  type="radio"
                  name="wallet-selection"
                  className="radio radio-primary"
                  checked={activeProviderType === "disabled"}
                  onChange={() => handleProviderTypeChange("disabled")}
                />
                <div className="flex-1">
                  <div className="font-medium">🚫 No wallet</div>
                  <div className="text-sm text-gray-500">Disable Lightning payments</div>
                </div>
              </label>

              {/* Native WebLN option */}
              {nativeProvider && (
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-base-50">
                  <input
                    type="radio"
                    name="wallet-selection"
                    className="radio radio-primary"
                    checked={activeProviderType === "native"}
                    onChange={() => handleProviderTypeChange("native")}
                  />
                  <div className="flex-1">
                    <div className="font-medium">⚡ Native WebLN</div>
                    <div className="text-sm text-gray-500">Browser extension wallet</div>
                  </div>
                </label>
              )}

              {/* NWC Connections */}
              {nwcConnections.map((conn) => (
                <label
                  key={conn.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-base-50"
                >
                  <input
                    type="radio"
                    name="wallet-selection"
                    className="radio radio-primary"
                    checked={activeProviderType === "nwc" && activeNWCId === conn.id}
                    onChange={() => handleNWCSelectionChange(conn.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">🔗 {conn.name}</div>
                    <div className="text-sm text-gray-500">
                      NWC Connection
                      {conn.balance !== undefined && ` • ${conn.balance} sats`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Add New Connection Button */}
          <div className="flex gap-2">
            <button
              className="btn btn-outline flex-1"
              onClick={() =>
                (
                  document.getElementById("add-nwc-modal") as HTMLDialogElement
                )?.showModal()
              }
            >
              + Add NWC Wallet
            </button>
            <button
              className="btn btn-outline flex-1"
              onClick={handleConnectLegacyWallet}
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting..." : "Quick Connect"}
            </button>
          </div>

          {/* Manage Connections */}
          {nwcConnections.length > 0 && (
            <div className="mt-4">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  (
                    document.getElementById(
                      "manage-connections-modal"
                    ) as HTMLDialogElement
                  )?.showModal()
                }
              >
                Manage Connections ({nwcConnections.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cashu Wallet Section */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4">Cashu Wallet</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Cashu ecash wallet</div>
              <div className="text-sm text-gray-500">
                For private, offline Bitcoin transactions
              </div>
            </div>
            <button
              className={`btn ${cashuEnabled ? "btn-error" : "btn-primary"}`}
              onClick={() => setCashuEnabled(!cashuEnabled)}
            >
              {cashuEnabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      </div>

      {/* Zap Settings Section */}
      <div className="card bg-base-100 shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4">Zap Settings</h2>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Default zap amount</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input input-bordered flex-1"
                onChange={handleDefaultZapAmountChange}
                value={defaultZapAmount}
                placeholder="21"
                min="1"
              />
              <span className="text-gray-500">sats</span>
            </div>
            <label className="label">
              <span className="label-text-alt text-gray-500">
                Amount used for one-click zapping
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Add NWC Connection Modal */}
      <dialog id="add-nwc-modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Add NWC Connection</h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Connection Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                placeholder="My Lightning Wallet"
                value={newNWCName}
                onChange={(e) => setNewNWCName(e.target.value)}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Connection String</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                placeholder="nostr+walletconnect://..."
                value={newNWCConnection}
                onChange={(e) => setNewNWCConnection(e.target.value)}
              />
              <label className="label">
                <span className="label-text-alt text-gray-500">
                  Get this from your wallet&apos;s NWC settings
                </span>
              </label>
            </div>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost">Cancel</button>
            </form>
            <button
              className="btn btn-primary"
              onClick={handleAddNWCConnection}
              disabled={!newNWCName.trim() || !newNWCConnection.trim() || isConnecting}
            >
              {isConnecting ? "Adding..." : "Add Connection"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Manage Connections Modal */}
      <dialog id="manage-connections-modal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Manage NWC Connections</h3>
          <div className="space-y-3">
            {nwcConnections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium">{conn.name}</div>
                  <div className="text-sm text-gray-500">
                    {conn.lastUsed
                      ? `Last used: ${new Date(conn.lastUsed).toLocaleDateString()}`
                      : "Never used"}
                  </div>
                  {conn.balance !== undefined && (
                    <div className="text-sm text-success">
                      Balance: {conn.balance} sats
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeNWCId === conn.id && (
                    <div className="badge badge-primary">Active</div>
                  )}
                  <button
                    className="btn btn-error btn-sm"
                    onClick={() => removeNWCConnection(conn.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  )
}

export default WalletSettings
