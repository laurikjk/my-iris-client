import {useState} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import type {GetInfoResponse} from "@cashu/cashu-ts"
import MintDetailsModal from "./MintDetailsModal"
import {useCashuWalletStore} from "@/stores/cashuWallet"
import {openExternalLink} from "@/utils/utils"

interface MintsListProps {
  balance: {[mintUrl: string]: number} | null
  manager: Manager | null
  onBalanceUpdate: () => void
  activeMint: string | null
  onMintClick: (mintUrl: string) => void
}

export default function MintsList({
  balance,
  manager,
  onBalanceUpdate,
  activeMint,
  onMintClick,
}: MintsListProps) {
  const {mintInfoCache} = useCashuWalletStore()
  const [mintUrl, setMintUrl] = useState("")
  const [selectedMintUrl, setSelectedMintUrl] = useState<string | null>(null)
  const [error, setError] = useState<string>("")

  // Get mints directly from cache - already populated by CashuWallet
  const allMints = Object.keys(mintInfoCache)
  const mintInfos = Object.entries(mintInfoCache).reduce(
    (acc, [url, {info}]) => {
      acc[url] = info
      return acc
    },
    {} as {[url: string]: GetInfoResponse}
  )

  const addMint = async () => {
    if (!manager || !mintUrl) return
    setError("")
    try {
      await manager.mint.addMint(mintUrl)
      const addedMintUrl = mintUrl
      setMintUrl("")

      // Set as active mint
      onMintClick(addedMintUrl)

      // Balance will update automatically, triggering re-render

      onBalanceUpdate()
    } catch (error) {
      console.error("Failed to add mint:", error)
      setError(
        "Failed to add mint: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    }
  }

  return (
    <div className="space-y-4">
      {allMints.map((mint) => {
        const bal = balance?.[mint] || 0
        const isActive = activeMint === mint
        const info = mintInfos[mint]
        return (
          <div
            key={mint}
            className={`p-4 rounded-lg cursor-pointer transition-colors ${
              isActive
                ? "bg-primary/20 border-2 border-primary hover:bg-primary/30"
                : "bg-base-200 hover:bg-base-300"
            }`}
            onClick={() => setSelectedMintUrl(mint)}
          >
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {info?.icon_url ? (
                  <img
                    src={info.icon_url}
                    alt={info.name || mint}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs">🏦</span>
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {info?.name || mint.replace(/^https?:\/\//, "")}
                    </span>
                    {isActive && (
                      <span className="badge badge-primary badge-sm">Active</span>
                    )}
                  </div>
                  {info?.name && (
                    <span className="text-xs opacity-60 truncate">
                      {mint.replace(/^https?:\/\//, "")}
                    </span>
                  )}
                </div>
              </div>
              <div className="font-bold ml-2 flex-shrink-0">{bal} bit</div>
            </div>
          </div>
        )
      })}

      <div className="card bg-base-100 shadow-xl mt-4">
        <div className="card-body">
          <h3 className="card-title">Add Mint</h3>
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <input
            type="text"
            placeholder="Mint URL"
            className="input input-bordered"
            value={mintUrl}
            onChange={(e) => setMintUrl(e.target.value)}
          />
          <button className="btn btn-primary" onClick={addMint}>
            Add Mint
          </button>
        </div>
      </div>

      <div className="alert alert-info mt-4">
        <div className="text-sm">
          Iris Cashu wallet is not affiliated with any mint and does not custody user
          funds. You can find a list of mints on{" "}
          <a
            href="https://bitcoinmints.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary"
            onClick={(e) => {
              e.preventDefault()
              openExternalLink("https://bitcoinmints.com")
            }}
          >
            bitcoinmints.com
          </a>
        </div>
      </div>

      <MintDetailsModal
        isOpen={selectedMintUrl !== null}
        onClose={() => setSelectedMintUrl(null)}
        mintUrl={selectedMintUrl || ""}
        manager={manager}
        onMintDeleted={() => {
          setSelectedMintUrl(null)
          onBalanceUpdate()
        }}
        activeMint={activeMint}
        onSetActive={onMintClick}
        balance={selectedMintUrl ? balance?.[selectedMintUrl] : undefined}
      />
    </div>
  )
}
