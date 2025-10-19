import {useState} from "react"
import type {Manager} from "@/lib/cashu/core/index"

interface MintsListProps {
  balance: {[mintUrl: string]: number} | null
  manager: Manager | null
  onBalanceUpdate: () => void
}

export default function MintsList({balance, manager, onBalanceUpdate}: MintsListProps) {
  const [mintUrl, setMintUrl] = useState("")

  const addMint = async () => {
    if (!manager || !mintUrl) return
    try {
      await manager.mint.addMint(mintUrl)
      setMintUrl("")
      onBalanceUpdate()
    } catch (error) {
      console.error("Failed to add mint:", error)
      alert(
        "Failed to add mint: " +
          (error instanceof Error ? error.message : "Unknown error")
      )
    }
  }

  return (
    <div className="space-y-4">
      {balance &&
        Object.entries(balance).map(([mint, bal]) => (
          <div key={mint} className="p-4 bg-base-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div className="text-sm truncate flex-1">{mint}</div>
              <div className="font-bold ml-4">{bal} sat</div>
            </div>
          </div>
        ))}

      <div className="card bg-base-100 shadow-xl mt-4">
        <div className="card-body">
          <h3 className="card-title">Add Mint</h3>
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
    </div>
  )
}
