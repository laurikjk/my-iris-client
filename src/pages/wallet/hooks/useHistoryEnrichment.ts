import {useCallback} from "react"
import type {HistoryEntry} from "@/lib/cashu/core/models/History"
import {IndexedDbRepositories} from "@/lib/cashu/indexeddb/index"
import {getPaymentMetadata, type PaymentMetadata} from "@/stores/paymentMetadata"

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

export function useHistoryEnrichment() {
  const enrichHistoryWithMetadata = useCallback(
    async (entries: HistoryEntry[]): Promise<EnrichedHistoryEntry[]> => {
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
            // First try to get metadata saved by entry ID (from ReceiveEcashMode)
            const entryMetadata = await getPaymentMetadata(`receive_entry_${entry.id}`)
            if (entryMetadata) {
              return {
                ...entry,
                paymentMetadata: entryMetadata,
              }
            }

            // Fallback: try to match with a send entry
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
    },
    []
  )

  return {enrichHistoryWithMetadata}
}
