import {useState, useEffect} from "react"
import {initCashuManager, getCashuManager} from "@/lib/cashu/manager"
import type {Manager} from "@/lib/cashu/core/index"
import {getDecodedToken} from "@cashu/cashu-ts"
import RightColumn from "@/shared/components/RightColumn"
import Widget from "@/shared/components/ui/Widget"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"

const DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin"

export default function CashuWallet() {
  const [manager, setManager] = useState<Manager | null>(null)
  const [balance, setBalance] = useState<{[mintUrl: string]: number} | null>(null)
  const [loading, setLoading] = useState(true)
  const [mintUrl, setMintUrl] = useState(DEFAULT_MINT)
  const [amount, setAmount] = useState<number>(100)
  const [invoice, setInvoice] = useState<string>("")
  const [token, setToken] = useState<string>("")

  useEffect(() => {
    const init = async () => {
      try {
        const mgr = getCashuManager() || (await initCashuManager())
        setManager(mgr)

        // Load balance
        const bal = await mgr.wallet.getBalances()
        setBalance(bal)
      } catch (error) {
        console.error("Failed to initialize Cashu manager:", error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const addMint = async () => {
    if (!manager || !mintUrl) return
    try {
      await manager.mint.addMint(mintUrl)
      const bal = await manager.wallet.getBalances()
      setBalance(bal)
    } catch (error) {
      console.error("Failed to add mint:", error)
    }
  }

  const createMintQuote = async () => {
    if (!manager || !mintUrl || !amount) return
    try {
      const quote = await manager.quotes.createMintQuote(mintUrl, amount)
      setInvoice(quote.request)
    } catch (error) {
      console.error("Failed to create mint quote:", error)
    }
  }

  const receiveToken = async () => {
    if (!manager || !token) return
    try {
      // Decode token to get mint URL
      const decoded = getDecodedToken(token)
      console.log("Decoded token:", decoded)

      // Token structure is { mint: string, proofs: [...] }
      const mintUrl = decoded.mint

      if (mintUrl) {
        // Check if mint is known, if not add it
        const isKnown = await manager.mint.isKnownMint(mintUrl)
        if (!isKnown) {
          console.log("Adding unknown mint:", mintUrl)
          await manager.mint.addMint(mintUrl)
        }
      }

      // Now receive the token
      await manager.wallet.receive(token)
      const bal = await manager.wallet.getBalances()
      setBalance(bal)
      setToken("")
    } catch (error) {
      console.error("Failed to receive token:", error)
    }
  }

  const sendToken = async () => {
    if (!manager || !mintUrl || !amount) return
    try {
      const sentToken = await manager.wallet.send(mintUrl, amount)
      setToken(JSON.stringify(sentToken))
      const bal = await manager.wallet.getBalances()
      setBalance(bal)
    } catch (error) {
      console.error("Failed to send token:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-base-content">Loading Cashu wallet...</div>
      </div>
    )
  }

  const totalBalance = balance
    ? Object.values(balance).reduce((sum, val) => sum + val, 0)
    : 0

  return (
    <div className="flex justify-center h-screen overflow-y-auto">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">Cashu Wallet</h2>
              <div className="text-3xl font-bold">{totalBalance} sats</div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Add Mint</h3>
              <div className="form-control">
                <input
                  type="text"
                  placeholder="Mint URL"
                  className="input input-bordered"
                  value={mintUrl}
                  onChange={(e) => setMintUrl(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={addMint}>
                Add Mint
              </button>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Receive (Mint)</h3>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Amount (sats)</span>
                </label>
                <input
                  type="number"
                  placeholder="100"
                  className="input input-bordered"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <button className="btn btn-primary" onClick={createMintQuote}>
                Create Invoice
              </button>
              {invoice && (
                <div className="alert">
                  <div className="text-sm break-all">{invoice}</div>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Receive Token</h3>
              <div className="form-control">
                <textarea
                  placeholder="Paste Cashu token here"
                  className="textarea textarea-bordered h-24"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={receiveToken}>
                Receive
              </button>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h3 className="card-title">Send</h3>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Amount (sats)</span>
                </label>
                <input
                  type="number"
                  placeholder="100"
                  className="input input-bordered"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
              </div>
              <button className="btn btn-primary" onClick={sendToken}>
                Create Token
              </button>
              {token && (
                <div className="alert">
                  <div className="text-sm break-all font-mono">{token}</div>
                </div>
              )}
            </div>
          </div>

          {balance && Object.keys(balance).length > 0 && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h3 className="card-title">Balances by Mint</h3>
                <div className="space-y-2">
                  {Object.entries(balance).map(([mint, bal]) => (
                    <div key={mint} className="flex justify-between">
                      <span className="text-sm truncate">{mint}</span>
                      <span className="font-bold">{bal} sats</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular" className="h-96">
              <AlgorithmicFeed
                type="popular"
                displayOptions={{
                  small: true,
                  showDisplaySelector: false,
                }}
              />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}
