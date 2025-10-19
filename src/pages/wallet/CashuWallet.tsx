import {useState, useEffect} from "react"
import {initCashuManager, getCashuManager} from "@/lib/cashu/manager"
import type {Manager} from "@/lib/cashu/core/index"
import type {HistoryEntry, SendHistoryEntry} from "@/lib/cashu/core/models/History"
import type {Token} from "@cashu/cashu-ts"
import RightColumn from "@/shared/components/RightColumn"
import Widget from "@/shared/components/ui/Widget"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {useCashuWalletStore} from "@/stores/cashuWallet"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {RiArrowRightUpLine, RiArrowLeftDownLine} from "@remixicon/react"
import SendDialog from "./cashu/SendDialog"
import ReceiveDialog from "./cashu/ReceiveDialog"
import HistoryList from "./cashu/HistoryList"
import MintsList from "./cashu/MintsList"
import {formatUsd} from "./cashu/utils"
import {useNavigate} from "@/navigation"

const DEFAULT_MINT = "https://mint.minibits.cash/Bitcoin"

export default function CashuWallet() {
  const {expandHistory, activeTab, toggleExpandHistory, setActiveTab} =
    useCashuWalletStore()
  const {activeProviderType} = useWalletProviderStore()
  const navigate = useNavigate()

  const [manager, setManager] = useState<Manager | null>(null)
  const [balance, setBalance] = useState<{[mintUrl: string]: number} | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [sendDialogInitialToken, setSendDialogInitialToken] = useState<Token | undefined>(
    undefined
  )

  const refreshData = async () => {
    if (!manager) return
    try {
      const bal = await manager.wallet.getBalances()
      setBalance(bal)
      const hist = await manager.history.getPaginatedHistory(0, 50)
      setHistory(hist)
    } catch (error) {
      console.error("Failed to refresh data:", error)
    }
  }

  const handleSendEntryClick = (entry: SendHistoryEntry) => {
    setSendDialogInitialToken(entry.token)
    setShowSendDialog(true)
  }

  const handleCloseSendDialog = () => {
    setShowSendDialog(false)
    setSendDialogInitialToken(undefined)
  }

  // Redirect to settings if default Cashu wallet is not selected
  useEffect(() => {
    if (activeProviderType !== undefined && activeProviderType !== "cashu") {
      navigate("/settings/wallet")
    }
  }, [activeProviderType, navigate])

  useEffect(() => {
    const init = async () => {
      try {
        const mgr = getCashuManager() || (await initCashuManager())
        setManager(mgr)

        // Load balance
        const bal = await mgr.wallet.getBalances()
        setBalance(bal)

        // Load history
        const hist = await mgr.history.getPaginatedHistory(0, 50)
        setHistory(hist)
      } catch (error) {
        console.error("Failed to initialize Cashu manager:", error)
      } finally {
        setLoading(false)
      }
    }
    init()

    // Fetch USD rate from Coinbase
    const fetchUsdRate = async () => {
      try {
        const response = await fetch(
          "https://api.coinbase.com/v2/exchange-rates?currency=BTC"
        )
        const data = await response.json()
        setUsdRate(parseFloat(data.data.rates.USD))
      } catch (error) {
        console.error("Failed to fetch USD rate:", error)
      }
    }
    fetchUsdRate()

    // Refresh rate every 60 seconds
    const rateInterval = setInterval(fetchUsdRate, 60000)
    return () => clearInterval(rateInterval)
  }, [])

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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {/* Balance Section */}
          <div className="pt-16 pb-8 text-center">
            {/* Balance Display */}
            <div className="text-5xl font-bold mb-2">{totalBalance} sat</div>
            <div className="text-xl text-base-content/60">
              {formatUsd(totalBalance, usdRate)}
            </div>

            {/* Mint Info */}
            {balance && Object.keys(balance).length > 0 && (
              <div className="text-sm text-base-content/60 mt-4">
                Mint:{" "}
                <span className="font-medium">
                  {Object.keys(balance)[0].replace(/^https?:\/\//, "")}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 px-4 py-8 relative">
            <button
              onClick={() => setShowReceiveDialog(true)}
              className="btn btn-primary rounded-full px-6 flex-1 max-w-[150px]"
            >
              <RiArrowLeftDownLine className="w-5 h-5 mr-1" />
              RECEIVE
            </button>

            <button className="btn btn-outline btn-primary btn-circle absolute z-10 btn-lg">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </button>

            <button
              onClick={() => setShowSendDialog(true)}
              className="btn btn-primary rounded-full px-6 flex-1 max-w-[150px]"
            >
              SEND
              <RiArrowRightUpLine className="w-5 h-5 ml-1" />
            </button>
          </div>

          {/* History Section */}
          <div className="px-4">
            {/* Expand/Collapse Toggle */}
            <div className="flex justify-center py-4">
              <button onClick={toggleExpandHistory}>
                <svg
                  className={`w-6 h-6 transition-transform ${expandHistory ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {/* Tabs and Content */}
            {expandHistory && (
              <>
                <div className="flex border-b border-base-300">
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`px-4 py-2 ${
                      activeTab === "history"
                        ? "border-b-2 font-bold"
                        : "text-base-content/60"
                    }`}
                  >
                    History
                  </button>
                  <button
                    onClick={() => setActiveTab("mints")}
                    className={`px-4 py-2 ${
                      activeTab === "mints"
                        ? "border-b-2 font-bold"
                        : "text-base-content/60"
                    }`}
                  >
                    Mints
                  </button>
                </div>

                {/* History Tab */}
                {activeTab === "history" && (
                  <div className="py-4">
                    <HistoryList
                      history={history}
                      usdRate={usdRate}
                      onSendEntryClick={handleSendEntryClick}
                    />
                  </div>
                )}

                {/* Mints Tab */}
                {activeTab === "mints" && (
                  <div className="py-4">
                    <MintsList
                      balance={balance}
                      manager={manager}
                      onBalanceUpdate={refreshData}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <SendDialog
            isOpen={showSendDialog}
            onClose={handleCloseSendDialog}
            manager={manager}
            mintUrl={balance ? Object.keys(balance)[0] : DEFAULT_MINT}
            onSuccess={refreshData}
            initialToken={sendDialogInitialToken}
          />

          <ReceiveDialog
            isOpen={showReceiveDialog}
            onClose={() => setShowReceiveDialog(false)}
            manager={manager}
            mintUrl={balance ? Object.keys(balance)[0] : DEFAULT_MINT}
            onSuccess={refreshData}
          />
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
