import {useState, useEffect} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import MintDetailsModal from "./MintDetailsModal"
import {openExternalLink} from "@/utils/utils"

interface MintsListProps {
  balance: {[mintUrl: string]: number} | null
  manager: Manager | null
  onBalanceUpdate: () => void
}

export default function MintsList({balance, manager, onBalanceUpdate}: MintsListProps) {
  const [mintUrl, setMintUrl] = useState("")
  const [selectedMintUrl, setSelectedMintUrl] = useState<string | null>(null)
  const [error, setError] = useState<string>("")
  const [allMints, setAllMints] = useState<string[]>([])

  useEffect(() => {
    const loadMints = async () => {
      if (!manager) return
      try {
        const mints = await manager.mint.getAllMints()
        setAllMints(mints.map((m) => m.mintUrl))
      } catch (error) {
        console.error("Failed to load mints:", error)
      }
    }
    loadMints()
  }, [manager, balance])

  const addMint = async () => {
    if (!manager || !mintUrl) return
    setError("")
    try {
      await manager.mint.addMint(mintUrl)
      setMintUrl("")

      // Reload mints list
      const mints = await manager.mint.getAllMints()
      setAllMints(mints.map((m) => m.mintUrl))

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
      <div className="alert alert-info">
        <div className="text-sm">
          Iris Cashu wallet is not affiliated with any mint and does not custody user
          funds. You can find a list of mints on{" "}
          <button
            className="link link-primary"
            onClick={() => openExternalLink("https://bitcoinmints.com")}
          >
            bitcoinmints.com
          </button>
        </div>
      </div>

      {allMints.map((mint) => {
        const bal = balance?.[mint] || 0
        return (
          <div
            key={mint}
            className="p-4 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors"
            onClick={() => setSelectedMintUrl(mint)}
          >
            <div className="flex justify-between items-center">
              <div className="text-sm truncate flex-1">{mint}</div>
              <div className="font-bold ml-4">{bal} bit</div>
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

      <MintDetailsModal
        isOpen={selectedMintUrl !== null}
        onClose={() => setSelectedMintUrl(null)}
        mintUrl={selectedMintUrl || ""}
        manager={manager}
        onMintDeleted={() => {
          setSelectedMintUrl(null)
          onBalanceUpdate()
        }}
      />
    </div>
  )
}
