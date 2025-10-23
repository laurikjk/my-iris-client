import {useState, useEffect} from "react"
import {initCashuManager, getCashuManager} from "@/lib/cashu/manager"
import type {Manager} from "@/lib/cashu/core/index"
import type {HistoryEntry, SendHistoryEntry} from "@/lib/cashu/core/models/History"
import type {Token} from "@cashu/cashu-ts"
import {IndexedDbRepositories} from "@/lib/cashu/indexeddb/index"
import RightColumn from "@/shared/components/RightColumn"
import Widget from "@/shared/components/ui/Widget"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {useCashuWalletStore} from "@/stores/cashuWallet"
import {useWalletProviderStore} from "@/stores/walletProvider"
import {getPaymentMetadata, type PaymentMetadata} from "@/stores/paymentMetadata"
import {RiArrowRightUpLine, RiArrowLeftDownLine, RiRefreshLine} from "@remixicon/react"
import SendDialog from "./cashu/SendDialog"
import ReceiveDialog from "./cashu/ReceiveDialog"
import QRScannerModal from "./cashu/QRScannerModal"
import HistoryList from "./cashu/HistoryList"
import MintsList from "./cashu/MintsList"
import {formatUsd} from "./cashu/utils"
import {Link, useNavigate, useLocation} from "@/navigation"
import Header from "@/shared/components/header/Header"
import Icon from "@/shared/components/Icons/Icon"
import {usePublicKey} from "@/stores/user"
import {getNPubCashBalance, claimNPubCashTokens} from "@/lib/npubcash"
import {ndk} from "@/utils/ndk"
import TermsOfService from "@/shared/components/TermsOfService"
import {useSettingsStore} from "@/stores/settings"
import {isTauri} from "@/utils/utils"

export type EnrichedHistoryEntry = HistoryEntry & {
  paymentMetadata?: PaymentMetadata
}

const meltQuoteRepos = new IndexedDbRepositories({name: "iris-cashu-db"})
let meltQuoteReposInitialized = false

const ensureMeltQuoteReposInit = async () => {
  if (!meltQuoteReposInitialized) {
    await meltQuoteRepos.init()
    meltQuoteReposInitialized = true
  }
}

const DEFAULT_MINT = "https://mint.coinos.io"

export default function CashuWallet() {
  const {expandHistory, activeTab, toggleExpandHistory, setActiveTab} =
    useCashuWalletStore()
  const {activeProviderType} = useWalletProviderStore()
  const navigate = useNavigate()
  const location = useLocation()
  const myPubKey = usePublicKey()
  const {legal, updateLegal} = useSettingsStore()

  const [manager, setManager] = useState<Manager | null>(null)
  const [balance, setBalance] = useState<{[mintUrl: string]: number} | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<EnrichedHistoryEntry[]>([])
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [usdRate, setUsdRate] = useState<number | null>(null)
  const [sendDialogInitialToken, setSendDialogInitialToken] = useState<Token | undefined>(
    undefined
  )
  const [sendDialogInitialInvoice, setSendDialogInitialInvoice] = useState<string>("")
  const [receiveDialogInitialToken, setReceiveDialogInitialToken] = useState<string>("")
  const [refreshing, setRefreshing] = useState(false)
  const [qrError, setQrError] = useState<string>("")
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showToS, setShowToS] = useState(false)

  const enrichHistoryWithMetadata = async (
    entries: HistoryEntry[]
  ): Promise<EnrichedHistoryEntry[]> => {
    await ensureMeltQuoteReposInit()
    const enriched = await Promise.all(
      entries.map(async (entry) => {
        let invoice: string | undefined
        let memoFromToken: string | undefined

        if (entry.type === "mint") {
          invoice = entry.paymentRequest
        } else if (entry.type === "melt") {
          const quote = await meltQuoteRepos.meltQuoteRepository.getMeltQuote(
            entry.mintUrl,
            entry.quoteId
          )
          invoice = quote?.request
        } else if (entry.type === "send") {
          // For send entries, encode the token and extract memo
          if (entry.token) {
            const {getEncodedToken} = await import("@cashu/cashu-ts")
            invoice = getEncodedToken(entry.token)
            memoFromToken = entry.token.memo
          }
        } else if (entry.type === "receive") {
          // Receive entries don't have tokens, so match with a send entry
          // by amount, mint, and timestamp proximity (within 5 minutes)
          const matchingSend = entries.find(
            (e) =>
              e.type === "send" &&
              e.amount === entry.amount &&
              e.mintUrl === entry.mintUrl &&
              Math.abs(e.createdAt - entry.createdAt) < 5 * 60 * 1000 &&
              e.token
          )

          if (matchingSend && matchingSend.type === "send" && matchingSend.token) {
            const {getEncodedToken} = await import("@cashu/cashu-ts")
            invoice = getEncodedToken(matchingSend.token)
            memoFromToken = matchingSend.token.memo
          }
        }

        if (!invoice) {
          return entry
        }

        let metadata = await getPaymentMetadata(invoice)

        // Always use memo from token if available (it's the source of truth)
        if (memoFromToken) {
          metadata = metadata
            ? {
                ...metadata,
                message: memoFromToken,
              }
            : {
                type: "other" as const,
                invoice,
                message: memoFromToken,
                timestamp: Date.now(),
              }
        }

        return {
          ...entry,
          paymentMetadata: metadata,
        }
      })
    )
    return enriched
  }

  const refreshData = async (immediate = false) => {
    if (!manager) {
      console.warn("⚠️ No manager available for refresh")
      return
    }
    console.log(
      "🔄 Refreshing Cashu wallet data...",
      immediate ? "(immediate)" : "(delayed)"
    )
    try {
      // Add small delay to let cashu persist changes (unless immediate refresh)
      if (!immediate) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      const bal = await manager.wallet.getBalances()
      console.log("💰 Balance fetched:", bal)
      setBalance({...bal}) // Force new object reference

      const hist = await manager.history.getPaginatedHistory(0, 1000)
      console.log(
        "📜 Raw history entries from manager:",
        hist.length,
        hist.map((h) => ({
          type: h.type,
          amount: h.amount,
          timestamp: h.createdAt,
        }))
      )

      const enrichedHist = await enrichHistoryWithMetadata(hist)
      console.log("✨ Enriched history:", enrichedHist.length)
      setHistory([...enrichedHist]) // Force new array reference
      console.log("✅ Wallet data refreshed, history count:", enrichedHist.length)
    } catch (error) {
      console.error("❌ Failed to refresh data:", error)
    }
  }

  const handleSendEntryClick = (entry: SendHistoryEntry) => {
    setSendDialogInitialToken(entry.token)
    setShowSendDialog(true)
  }

  const handleCloseSendDialog = () => {
    setShowSendDialog(false)
    setSendDialogInitialToken(undefined)
    setSendDialogInitialInvoice("")
  }

  const handleCloseReceiveDialog = () => {
    setShowReceiveDialog(false)
    setReceiveDialogInitialToken("")
  }

  const handleRefresh = async () => {
    console.log("🔄 Manual refresh button clicked")
    setRefreshing(true)
    try {
      // Check pending melt quotes (for stuck Lightning payments)
      if (manager && balance) {
        const mints = Object.keys(balance)
        console.log("🔍 Checking pending melt quotes on mints:", mints)
        for (const mintUrl of mints) {
          try {
            // Force check by calling mint API directly
            const {CashuMint} = await import("@cashu/cashu-ts")
            const mint = new CashuMint(mintUrl)

            // Get pending quotes from our DB
            await ensureMeltQuoteReposInit()
            const pendingQuotes =
              await meltQuoteRepos.meltQuoteRepository.getPendingMeltQuotes()

            console.log(`📋 Found ${pendingQuotes.length} pending melt quotes`)

            // Check each one
            for (const quote of pendingQuotes) {
              try {
                const status = await mint.checkMeltQuote(quote.quote)
                console.log(`🔎 Quote ${quote.quote}: ${status.state}`)

                if (status.state === "PAID" && quote.state !== "PAID") {
                  console.log(`✅ Quote ${quote.quote} is now PAID, updating...`)
                  await meltQuoteRepos.meltQuoteRepository.setMeltQuoteState(
                    quote.mintUrl,
                    quote.quote,
                    "PAID"
                  )
                }
              } catch (err) {
                console.error(`Failed to check quote ${quote.quote}:`, err)
              }
            }
          } catch (err) {
            console.error(`Failed to check mint ${mintUrl}:`, err)
          }
        }
      }

      await refreshData(true) // immediate = true for manual refresh

      // Also check npub.cash
      if (myPubKey && ndk().signer) {
        const signer = ndk().signer
        if (signer) {
          const balance = await getNPubCashBalance(signer)
          if (balance > 0) {
            const token = await claimNPubCashTokens(signer)
            if (token && manager) {
              await manager.wallet.receive(token)
              await refreshData(true)
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleQRScanSuccess = async (result: string) => {
    setShowQRScanner(false)
    setQrError("")

    // Check if it's a Cashu token
    if (result.startsWith("cashu")) {
      setReceiveDialogInitialToken(result)
      setShowReceiveDialog(true)
      return
    }

    // Check if it's a Cashu payment request
    if (result.startsWith("creq")) {
      try {
        const {decodePaymentRequest} = await import("@cashu/cashu-ts")
        decodePaymentRequest(result) // Validate format

        // Handle payment request - open send dialog with request data
        setSendDialogInitialInvoice(result)
        setShowSendDialog(true)
        return
      } catch (error) {
        console.error("Failed to decode payment request:", error)
        setQrError("Invalid payment request")
        return
      }
    }

    // Check if it's a Lightning invoice
    if (result.toLowerCase().startsWith("lightning:")) {
      setSendDialogInitialInvoice(result.slice(10))
      setShowSendDialog(true)
      return
    }

    if (
      result.toLowerCase().startsWith("lnbc") ||
      result.toLowerCase().startsWith("lnurl")
    ) {
      setSendDialogInitialInvoice(result)
      setShowSendDialog(true)
      return
    }

    setQrError("Unrecognized QR code format")
  }

  // Handle receiveToken from navigation state
  useEffect(() => {
    const state = location.state as {receiveToken?: string} | undefined
    if (state?.receiveToken && manager) {
      setReceiveDialogInitialToken(state.receiveToken)
      setShowReceiveDialog(true)
    }
  }, [location.state, manager])

  // Handle paymentRequest from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paymentRequest = params.get("paymentRequest")
    if (paymentRequest && manager) {
      setSendDialogInitialInvoice(paymentRequest)
      setShowSendDialog(true)
      // Clear the URL param
      window.history.replaceState({}, "", "/wallet")
    }
  }, [location.search, manager])

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Check if we need to show ToS for non-Tauri wallet access
  useEffect(() => {
    if (!isTauri() && !legal.tosAccepted) {
      setShowToS(true)
    }
  }, [legal.tosAccepted])

  const handleToSAccept = () => {
    updateLegal({tosAccepted: true, tosAcceptedVersion: 1})
    setShowToS(false)
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
        const hist = await mgr.history.getPaginatedHistory(0, 1000)
        const enrichedHist = await enrichHistoryWithMetadata(hist)
        setHistory(enrichedHist)

        // Listen to events for real-time updates
        const updateData = async (eventName: string) => {
          console.log(`🎯 Event received: ${eventName}, updating wallet data...`)
          try {
            const bal = await mgr.wallet.getBalances()
            setBalance(bal)
            const hist = await mgr.history.getPaginatedHistory(0, 1000)
            const enrichedHist = await enrichHistoryWithMetadata(hist)
            setHistory(enrichedHist)
            console.log(`✅ Updated from ${eventName}`)
          } catch (error) {
            console.error("Failed to refresh data:", error)
          }
        }

        const unsubscribers = [
          mgr.on("melt-quote:paid", () => updateData("melt-quote:paid")),
          mgr.on("send:created", () => updateData("send:created")),
          mgr.on("receive:created", () => updateData("receive:created")),
          mgr.on("mint-quote:redeemed", () => updateData("mint-quote:redeemed")),
        ]

        return () => {
          unsubscribers.forEach((unsub) => unsub())
        }
      } catch (error) {
        console.error("Failed to initialize Cashu manager:", error)
      } finally {
        setLoading(false)
      }
    }

    const cleanup = init()

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

    return () => {
      cleanup.then((cleanupFn) => cleanupFn?.())
      clearInterval(rateInterval)
    }
  }, [])

  // Check npub.cash balance periodically and auto-claim
  useEffect(() => {
    if (!myPubKey || !ndk().signer || !manager) return

    const checkAndClaim = async () => {
      const signer = ndk().signer
      if (!signer) return

      try {
        const balance = await getNPubCashBalance(signer)

        // Auto-claim if balance > 0
        if (balance > 0) {
          const token = await claimNPubCashTokens(signer)
          if (token) {
            await manager.wallet.receive(token)
            await refreshData()
          }
        }
      } catch (error) {
        console.error("Failed to check/claim npub.cash:", error)
      }
    }

    checkAndClaim()

    // Check every 60 seconds
    const balanceInterval = setInterval(checkAndClaim, 60000)

    return () => clearInterval(balanceInterval)
  }, [myPubKey, manager])

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
    <>
      {showToS && <TermsOfService onAccept={handleToSAccept} />}
      <Header>
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate">Wallet</span>
            {isOffline && (
              <span className="badge badge-sm badge-error text-xs">Offline</span>
            )}
          </div>
          <div className="flex gap-2 md:gap-3 mr-6 md:mr-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
              title="Refresh"
            >
              <RiRefreshLine className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <Link
              to="/settings/wallet"
              className="btn btn-circle btn-ghost btn-sm flex-shrink-0"
              title="Wallet Settings"
            >
              <Icon name="gear" className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </Header>
      <div className="flex justify-center h-screen overflow-y-auto">
        <div className="flex-1 overflow-y-auto" data-main-scroll-container="true">
          <div className="max-w-2xl mx-auto pb-24 md:pb-0 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
            {/* Balance Section */}
            <div className="pt-16 md:pt-8 pb-8 text-center">
              {/* Balance Display */}
              <div className="text-5xl font-bold mb-2">{totalBalance} bit</div>
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
            <div className="flex items-center justify-center gap-6 px-4 py-8">
              <button
                onClick={() => setShowReceiveDialog(true)}
                className="btn btn-primary rounded-full px-6"
              >
                <RiArrowLeftDownLine className="w-5 h-5 mr-1" />
                RECEIVE
              </button>

              <button
                onClick={() => setShowQRScanner(true)}
                className="btn btn-ghost btn-circle btn-lg"
              >
                <svg
                  className="w-7 h-7"
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
                className="btn btn-primary rounded-full px-6"
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
              initialInvoice={sendDialogInitialInvoice}
              balance={totalBalance}
            />

            <ReceiveDialog
              isOpen={showReceiveDialog}
              onClose={handleCloseReceiveDialog}
              manager={manager}
              mintUrl={balance ? Object.keys(balance)[0] : DEFAULT_MINT}
              onSuccess={refreshData}
              initialToken={receiveDialogInitialToken}
              balance={totalBalance}
              onScanRequest={() => setShowQRScanner(true)}
            />

            <QRScannerModal
              isOpen={showQRScanner}
              onClose={() => {
                setShowQRScanner(false)
                setQrError("")
              }}
              onScanSuccess={handleQRScanSuccess}
            />

            {qrError && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md">
                <div className="alert alert-error">
                  <span>{qrError}</span>
                  <button className="btn btn-sm btn-ghost" onClick={() => setQrError("")}>
                    ✕
                  </button>
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
    </>
  )
}
