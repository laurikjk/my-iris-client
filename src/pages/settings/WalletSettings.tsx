import {useWalletBalance} from "@/shared/hooks/useWalletBalance"
import {useUserStore} from "@/stores/user"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {SettingsInputItem} from "@/shared/components/settings/SettingsInputItem"
import {ChangeEvent, useState, useEffect} from "react"

const WalletSettings = () => {
  const {balance} = useWalletBalance()
  const {defaultZapAmount, setDefaultZapAmount} = useUserStore()

  const {
    activeProviderType,
    activeNWCId,
    nativeWallet,
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

  // Local state to track selected wallet - this ensures UI updates immediately
  const [selectedWallet, setSelectedWallet] = useState<string>(() => {
    if (activeProviderType === "disabled") return "disabled"
    if (activeProviderType === "native") return "native"
    if (activeProviderType === "nwc" && activeNWCId) return `nwc:${activeNWCId}`
    return "disabled"
  })

  // Sync local state with store changes
  useEffect(() => {
    if (activeProviderType === "disabled") {
      setSelectedWallet("disabled")
    } else if (activeProviderType === "native") {
      setSelectedWallet("native")
    } else if (activeProviderType === "nwc" && activeNWCId) {
      setSelectedWallet(`nwc:${activeNWCId}`)
    }
  }, [activeProviderType, activeNWCId])

  // Removed unused functions - logic is now inline in the onClick/onChange handlers

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
    if (activeProviderType === "disabled" || activeProviderType === undefined)
      return "No wallet connected"
    if (balance !== null) return `${balance.toLocaleString()}₿`
    return ""
  }

  const getCurrentWalletDisplay = () => {
    console.log("📱 Getting current wallet display:", {
      activeProviderType,
      activeNWCId,
      nwcConnectionsCount: nwcConnections.length,
    })

    if (activeProviderType === "disabled" || activeProviderType === undefined)
      return "No wallet connected"
    if (activeProviderType === "native") return "Native WebLN"
    if (activeProviderType === "nwc" && activeNWCId) {
      const connection = nwcConnections.find((c) => c.id === activeNWCId)
      console.log("📱 Found NWC connection:", connection?.name)
      return connection ? connection.name : "Unknown NWC"
    }
    return "No wallet selected"
  }

  return (
    <div className="bg-base-200 min-h-full">
      <div className="p-4">
        <div className="space-y-6">
          <SettingsGroup title="Status">
            <SettingsGroupItem>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">Current Wallet</span>
                  <div className="text-sm text-base-content/70">
                    {getCurrentWalletDisplay()}
                  </div>
                </div>
                {balance !== null && balance > 0 && (
                  <div className="badge badge-success">Connected</div>
                )}
              </div>
            </SettingsGroupItem>
            <SettingsGroupItem isLast>
              <div className="flex justify-between items-center">
                <span className="font-medium">Balance</span>
                <span className="text-base-content/70">{getBalanceDisplay()}</span>
              </div>
            </SettingsGroupItem>
          </SettingsGroup>

          <SettingsGroup title="Select Wallet">
            {/* No wallet option */}
            <SettingsGroupItem
              onClick={() => {
                console.log("🖱️ Div clicked for disabled wallet")
                setSelectedWallet("disabled")
                setActiveProviderType("disabled")
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="wallet-selection"
                    className="radio radio-primary"
                    checked={selectedWallet === "disabled"}
                    onChange={() => {
                      setSelectedWallet("disabled")
                      setActiveProviderType("disabled")
                    }}
                  />
                  <div>
                    <div className="font-medium">🚫 No wallet</div>
                    <div className="text-sm text-base-content/60">Disable Quick Zaps</div>
                  </div>
                </div>
              </div>
            </SettingsGroupItem>

            {/* Native WebLN option */}
            {nativeWallet && (
              <SettingsGroupItem
                onClick={() => {
                  console.log("🖱️ Div clicked for native wallet")
                  setSelectedWallet("native")
                  setActiveProviderType("native")
                  useWalletProviderStore.getState().refreshActiveProvider()
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="wallet-selection"
                      className="radio radio-primary"
                      checked={selectedWallet === "native"}
                      onChange={() => {
                        setSelectedWallet("native")
                        setActiveProviderType("native")
                        useWalletProviderStore.getState().refreshActiveProvider()
                      }}
                    />
                    <div>
                      <div className="font-medium">⚡ Native WebLN</div>
                      <div className="text-sm text-base-content/60">
                        Browser extension wallet
                      </div>
                    </div>
                  </div>
                </div>
              </SettingsGroupItem>
            )}

            {/* NWC Connections */}
            {nwcConnections.map((conn, index) => {
              const isChecked = selectedWallet === `nwc:${conn.id}`
              const isLast = index === nwcConnections.length - 1
              return (
                <SettingsGroupItem
                  key={conn.id}
                  isLast={isLast}
                  onClick={() => {
                    console.log("🖱️ Div clicked for NWC:", conn.name)
                    const walletId = `nwc:${conn.id}`
                    setSelectedWallet(walletId)
                    setActiveProviderType("nwc")
                    setActiveNWCId(conn.id)
                    connectToNWC(conn.id).then(() => {
                      useWalletProviderStore.getState().refreshActiveProvider()
                    })
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="wallet-selection"
                        className="radio radio-primary"
                        checked={isChecked}
                        onChange={() => {
                          const walletId = `nwc:${conn.id}`
                          setSelectedWallet(walletId)
                          setActiveProviderType("nwc")
                          setActiveNWCId(conn.id)
                          connectToNWC(conn.id).then(() => {
                            useWalletProviderStore.getState().refreshActiveProvider()
                          })
                        }}
                      />
                      <div>
                        <div className="font-medium">🔗 {conn.name}</div>
                        <div className="text-sm text-base-content/60">
                          NWC Connection
                          {conn.balance !== undefined && ` • ${conn.balance}₿`}
                        </div>
                      </div>
                    </div>
                  </div>
                </SettingsGroupItem>
              )
            })}
          </SettingsGroup>

          <SettingsGroup title="Manage Connections">
            <SettingsGroupItem
              onClick={() =>
                (
                  document.getElementById("add-nwc-modal") as HTMLDialogElement
                )?.showModal()
              }
              isLast={nwcConnections.length === 0}
            >
              <div className="flex justify-between items-center">
                <span>Add NWC Wallet</span>
                <span className="text-primary">+</span>
              </div>
            </SettingsGroupItem>

            {nwcConnections.length > 0 && (
              <SettingsGroupItem
                isLast
                onClick={() =>
                  (
                    document.getElementById(
                      "manage-connections-modal"
                    ) as HTMLDialogElement
                  )?.showModal()
                }
              >
                <div className="flex justify-between items-center">
                  <span>Manage Connections</span>
                  <span className="text-sm text-base-content/60">
                    {nwcConnections.length} connection
                    {nwcConnections.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </SettingsGroupItem>
            )}
          </SettingsGroup>

          <SettingsGroup title="Zap Settings">
            <SettingsInputItem
              label="Default zap amount"
              value={defaultZapAmount.toString()}
              onChange={(value) =>
                handleDefaultZapAmountChange({
                  target: {value},
                } as ChangeEvent<HTMLInputElement>)
              }
              type="text"
              rightContent={<span className="text-base-content/60">₿</span>}
              isLast
            />
          </SettingsGroup>
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
                    <div className="text-sm text-success">Balance: {conn.balance}₿</div>
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
