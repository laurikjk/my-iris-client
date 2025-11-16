import {useWalletBalance} from "@/shared/hooks/useWalletBalance"
import {useUserStore} from "@/stores/user"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {useWalletStore} from "@/stores/wallet"
import {SettingsGroup} from "@/shared/components/settings/SettingsGroup"
import {SettingsGroupItem} from "@/shared/components/settings/SettingsGroupItem"
import {SettingsInputItem} from "@/shared/components/settings/SettingsInputItem"
import {CashuSeedBackup} from "@/shared/components/settings/CashuSeedBackup"
import {ChangeEvent, useState, useEffect} from "react"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"

const {log} = createDebugLogger(DEBUG_NAMESPACES.CASHU_WALLET)

const WalletSettings = () => {
  const {balance} = useWalletBalance()
  const {showBalanceInNav, setShowBalanceInNav} = useWalletStore()
  const {defaultZapAmount, setDefaultZapAmount, defaultZapComment, setDefaultZapComment} =
    useUserStore()

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
  const [showAddForm, setShowAddForm] = useState(false)

  // Local state to track selected wallet - this ensures UI updates immediately
  const [selectedWallet, setSelectedWallet] = useState<string>(() => {
    if (activeProviderType === "disabled") return "disabled"
    if (activeProviderType === "cashu") return "cashu"
    if (activeProviderType === "native") return "native"
    if (activeProviderType === "nwc" && activeNWCId) return `nwc:${activeNWCId}`
    return "cashu"
  })

  // Sync local state with store changes
  useEffect(() => {
    if (activeProviderType === "disabled") {
      setSelectedWallet("disabled")
    } else if (activeProviderType === "cashu") {
      setSelectedWallet("cashu")
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
    setShowAddForm(false)

    // Auto-select the new connection
    setActiveProviderType("nwc")
    setActiveNWCId(id)

    setIsConnecting(true)
    try {
      await connectToNWC(id)
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

  const handleDefaultZapCommentChange = (value: string) => {
    setDefaultZapComment(value)
  }

  const getBalanceDisplay = () => {
    if (activeProviderType === "disabled" || activeProviderType === undefined)
      return "No wallet connected"
    if (balance !== null) return `${balance.toLocaleString()}₿`
    return ""
  }

  const getCurrentWalletDisplay = () => {
    log("📱 Getting current wallet display:", {
      activeProviderType,
      activeNWCId,
      nwcConnectionsCount: nwcConnections.length,
    })

    if (activeProviderType === "disabled") return "No wallet connected"
    if (activeProviderType === "cashu") return "Cashu Wallet"
    if (activeProviderType === "native") return "Native WebLN"
    if (activeProviderType === "nwc" && activeNWCId) {
      const connection = nwcConnections.find((c) => c.id === activeNWCId)
      log("📱 Found NWC connection:", connection?.name)
      return connection ? connection.name : "Unknown NWC"
    }
    return "Cashu Wallet"
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
            {/* Cashu wallet option */}
            <SettingsGroupItem
              onClick={() => {
                log("🖱️ Div clicked for cashu wallet")
                setSelectedWallet("cashu")
                setActiveProviderType("cashu")
                useWalletProviderStore.getState().refreshActiveProvider()
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="wallet-selection"
                    className="radio radio-primary"
                    checked={selectedWallet === "cashu"}
                    onChange={() => {
                      setSelectedWallet("cashu")
                      setActiveProviderType("cashu")
                      useWalletProviderStore.getState().refreshActiveProvider()
                    }}
                  />
                  <div>
                    <div className="font-medium">Cashu Wallet</div>
                    <div className="text-sm text-base-content/60">
                      Default built-in wallet
                    </div>
                  </div>
                </div>
              </div>
            </SettingsGroupItem>

            {/* No wallet option */}
            <SettingsGroupItem
              onClick={() => {
                log("🖱️ Div clicked for disabled wallet")
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
                    <div className="font-medium">No wallet</div>
                    <div className="text-sm text-base-content/60">Disable Quick Zaps</div>
                  </div>
                </div>
              </div>
            </SettingsGroupItem>

            {/* Native WebLN option */}
            {nativeWallet && (
              <SettingsGroupItem
                onClick={() => {
                  log("🖱️ Div clicked for native wallet")
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
                      <div className="font-medium">Native WebLN</div>
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
              const isLast = index === nwcConnections.length - 1 && !showAddForm
              return (
                <SettingsGroupItem
                  key={conn.id}
                  isLast={isLast}
                  onClick={(e) => {
                    // Don't trigger selection when clicking delete button
                    if (e && (e.target as HTMLElement).closest(".btn-error")) return
                    log("🖱️ Div clicked for NWC:", conn.name)
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
                        <div className="font-medium">{conn.name}</div>
                        <div className="text-sm text-base-content/60">
                          NWC Connection
                          {conn.balance !== undefined && ` • ${conn.balance}₿`}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-error btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeNWCConnection(conn.id)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </SettingsGroupItem>
              )
            })}

            {/* Add NWC Form */}
            {showAddForm && (
              <SettingsGroupItem isLast>
                <div className="space-y-3">
                  <div className="form-control">
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      placeholder="Connection Name"
                      value={newNWCName}
                      onChange={(e) => setNewNWCName(e.target.value)}
                    />
                  </div>
                  <div className="form-control">
                    <textarea
                      className="textarea textarea-bordered textarea-sm h-20"
                      placeholder="nostr+walletconnect://..."
                      value={newNWCConnection}
                      onChange={(e) => setNewNWCConnection(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewNWCName("")
                        setNewNWCConnection("")
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleAddNWCConnection}
                      disabled={
                        !newNWCName.trim() || !newNWCConnection.trim() || isConnecting
                      }
                    >
                      {isConnecting ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              </SettingsGroupItem>
            )}

            {/* Add NWC Button */}
            {!showAddForm && (
              <SettingsGroupItem isLast onClick={() => setShowAddForm(true)}>
                <div className="flex justify-between items-center">
                  <span>Add NWC Connection</span>
                  <span className="text-primary">+</span>
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
            />
            <SettingsInputItem
              label="Default zap comment"
              value={defaultZapComment}
              onChange={handleDefaultZapCommentChange}
              type="text"
              placeholder="Optional comment for quick zaps"
              isLast
            />
          </SettingsGroup>

          <SettingsGroup title="Display">
            <SettingsGroupItem
              isLast
              onClick={() => setShowBalanceInNav(!showBalanceInNav)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Show balance in navbar / footer</div>
                  <div className="text-sm text-base-content/60">
                    Display your wallet balance in the navigation
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={showBalanceInNav}
                  onChange={(e) => setShowBalanceInNav(e.target.checked)}
                />
              </div>
            </SettingsGroupItem>
          </SettingsGroup>

          <SettingsGroup title="Backup">
            <SettingsGroupItem isLast>
              <CashuSeedBackup />
            </SettingsGroupItem>
          </SettingsGroup>

          <SettingsGroup title="Legacy Wallet">
            <SettingsGroupItem isLast>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Access Legacy Cashu Wallet</div>
                  <div className="text-sm text-base-content/60">
                    If you have funds in the old wallet, recover them here
                  </div>
                </div>
                <a href="/old-wallet" className="btn btn-sm btn-outline">
                  Open Legacy Wallet
                </a>
              </div>
            </SettingsGroupItem>
          </SettingsGroup>
        </div>
      </div>
    </div>
  )
}

export default WalletSettings
