import {useState, useCallback} from "react"
import type {Manager} from "@/lib/cashu/core/index"
import type {HistoryEntry} from "@/lib/cashu/core/models/History"
import {IndexedDbRepositories} from "@/lib/cashu/indexeddb/index"
import {
  getNPubCashBalance,
  claimNPubCashTokens,
  extractMintFromToken,
} from "@/lib/npubcash"
import {ndk} from "@/utils/ndk"
import type {EnrichedHistoryEntry} from "./useHistoryEnrichment"
import {createDebugLogger} from "@/utils/createDebugLogger"
import {DEBUG_NAMESPACES} from "@/utils/constants"
const {log, warn, error} = createDebugLogger(DEBUG_NAMESPACES.CASHU_WALLET)

const meltQuoteRepos = new IndexedDbRepositories({name: "iris-cashu-db"})
let meltQuoteReposInitialized = false

const ensureMeltQuoteReposInit = async () => {
  if (!meltQuoteReposInitialized) {
    await meltQuoteRepos.init()
    meltQuoteReposInitialized = true
  }
}

export function useWalletRefresh(
  manager: Manager | null,
  myPubKey: string | null,
  enrichHistoryWithMetadata: (entries: HistoryEntry[]) => Promise<EnrichedHistoryEntry[]>
) {
  const [refreshing, setRefreshing] = useState(false)

  const refreshData = useCallback(
    async (immediate = false) => {
      if (!manager) {
        warn("⚠️ No manager available for refresh")
        return
      }
      log("🔄 Refreshing Cashu wallet data...", immediate ? "(immediate)" : "(delayed)")
      try {
        // Add small delay to let cashu persist changes (unless immediate refresh)
        if (!immediate) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }

        const bal = await manager.wallet.getBalances()
        log("💰 Balance fetched:", bal)

        const hist = await manager.history.getPaginatedHistory(0, 1000)
        log(
          "📜 Raw history entries from manager:",
          hist.length,
          hist.map((h) => ({
            type: h.type,
            amount: h.amount,
            timestamp: h.createdAt,
          }))
        )

        const enrichedHist = await enrichHistoryWithMetadata(hist)
        log("✅ Wallet data refreshed, history count:", enrichedHist.length)

        return {balance: bal, history: enrichedHist}
      } catch (err) {
        error("❌ Failed to refresh data:", err)
        throw err
      }
    },
    [manager, enrichHistoryWithMetadata]
  )

  const handleRefresh = useCallback(
    async (balance: {[mintUrl: string]: number} | null) => {
      log("🔄 Manual refresh button clicked")
      setRefreshing(true)
      try {
        // Check and redeem pending mint quotes (for stuck incoming Lightning payments)
        if (manager) {
          log("🔍 Checking and requeueing paid mint quotes")
          try {
            const result = await manager.quotes.requeuePaidMintQuotes()
            log(`✅ Requeued ${result.requeued.length} paid mint quotes for redemption`)
            if (result.requeued.length > 0) {
              log("⏳ Waiting for quotes to be processed...")
              // Give processor time to redeem quotes
              await new Promise((resolve) => setTimeout(resolve, 3000))
            }
          } catch (err) {
            error("Failed to requeue mint quotes:", err)
          }

          // Force recalculate balance from all proofs in database
          log("🔍 Recalculating balance from all proofs")
          try {
            const freshBalance = await manager.wallet.getBalances()
            log("💰 Fresh balance:", freshBalance)
          } catch (err) {
            error("Failed to recalculate balance:", err)
          }
        }

        // Check pending melt quotes (for stuck outgoing Lightning payments)
        if (manager && balance) {
          const mints = Object.keys(balance)
          log("🔍 Checking pending melt quotes on mints:", mints)
          for (const mintUrl of mints) {
            try {
              // Force check by calling mint API directly
              const {CashuMint} = await import("@cashu/cashu-ts")
              const mint = new CashuMint(mintUrl)

              // Get pending quotes from our DB
              await ensureMeltQuoteReposInit()
              const pendingQuotes =
                await meltQuoteRepos.meltQuoteRepository.getPendingMeltQuotes()

              log(`📋 Found ${pendingQuotes.length} pending melt quotes`)

              // Check each one
              for (const quote of pendingQuotes) {
                try {
                  const status = await mint.checkMeltQuote(quote.quote)
                  log(`🔎 Quote ${quote.quote}: ${status.state}`)

                  if (status.state === "PAID" && quote.state !== "PAID") {
                    log(`✅ Quote ${quote.quote} is now PAID, updating...`)
                    await meltQuoteRepos.meltQuoteRepository.setMeltQuoteState(
                      quote.mintUrl,
                      quote.quote,
                      "PAID"
                    )
                  }
                } catch (err) {
                  error(`Failed to check quote ${quote.quote}:`, err)
                }
              }
            } catch (err) {
              error(`Failed to check mint ${mintUrl}:`, err)
            }
          }
        }

        const data = await refreshData(true) // immediate = true for manual refresh

        // Also check npub.cash
        if (myPubKey && ndk().signer) {
          const signer = ndk().signer
          if (signer) {
            const balance = await getNPubCashBalance(signer)
            if (balance > 0) {
              const token = await claimNPubCashTokens(signer)
              if (token && manager) {
                // Extract mint URL from token and ensure it's added
                const mintUrl = await extractMintFromToken(token)
                if (mintUrl) {
                  try {
                    await manager.mint.addMint(mintUrl)
                    log(`✅ Auto-added mint from npub.cash token: ${mintUrl}`)
                  } catch (err) {
                    log(`Mint already exists or failed to add: ${mintUrl}`)
                  }
                }

                await manager.wallet.receive(token)
                return await refreshData(true)
              }
            }
          }
        }

        return data
      } catch (err) {
        error("Failed to refresh:", err)
        throw err
      } finally {
        setRefreshing(false)
      }
    },
    [manager, myPubKey, refreshData]
  )

  return {refreshing, refreshData, handleRefresh}
}
