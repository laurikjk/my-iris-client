import type {SendHistoryEntry} from "@/lib/cashu/core/models/History"
import type {EnrichedHistoryEntry} from "../CashuWallet"
import {RiFlashlightFill, RiCoinsFill} from "@remixicon/react"
import {useState} from "react"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {getTransactionAmount, getTransactionStatus, formatDate, formatUsd} from "./utils"
import {Avatar} from "@/shared/components/user/Avatar"
import {Name} from "@/shared/components/user/Name"
import {useNavigate} from "@/navigation"
import {nip19} from "nostr-tools"

const INITIAL_DISPLAY = 20
const DISPLAY_INCREMENT = 20

interface HistoryListProps {
  history: EnrichedHistoryEntry[]
  usdRate: number | null
  onSendEntryClick?: (entry: SendHistoryEntry) => void
}

export default function HistoryList({
  history,
  usdRate,
  onSendEntryClick,
}: HistoryListProps) {
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY)
  const navigate = useNavigate()

  if (history.length === 0) {
    return (
      <div className="text-center text-base-content/60 py-8">No transactions yet</div>
    )
  }

  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + DISPLAY_INCREMENT)
  }

  const visibleHistory = history.slice(0, displayCount)

  const content = (
    <>
      {visibleHistory.map((entry) => {
        const amount = getTransactionAmount(entry)
        const status = getTransactionStatus(entry)
        const isSend = entry.type === "send"
        const isZapWithEvent =
          entry.paymentMetadata?.type === "zap" && entry.paymentMetadata?.eventId
        const isClickable = (isSend && onSendEntryClick) || isZapWithEvent

        // Determine if it's Lightning (mint/melt) or Ecash (send/receive)
        const label =
          entry.type === "mint" || entry.type === "melt" ? "Lightning" : "Ecash"

        const handleClick = () => {
          if (isZapWithEvent && entry.paymentMetadata?.eventId) {
            navigate(`/${nip19.noteEncode(entry.paymentMetadata.eventId)}`)
          } else if (isSend && onSendEntryClick) {
            onSendEntryClick(entry as SendHistoryEntry)
          }
        }

        return (
          <div
            key={entry.id}
            className={`flex items-center justify-between p-4 bg-base-200 rounded-lg ${
              isClickable ? "cursor-pointer hover:bg-base-300 transition-colors" : ""
            }`}
            onClick={handleClick}
          >
            <div className="flex items-center gap-3">
              {entry.paymentMetadata?.peerPubkey && (
                <Avatar pubKey={entry.paymentMetadata.peerPubkey} width={32} />
              )}
              {!entry.paymentMetadata?.peerPubkey && label === "Lightning" && (
                <RiFlashlightFill className="w-5 h-5" />
              )}
              {!entry.paymentMetadata?.peerPubkey && label !== "Lightning" && (
                <RiCoinsFill className="w-5 h-5" />
              )}
              <div>
                {entry.paymentMetadata?.peerPubkey ? (
                  <div className="font-medium">
                    {entry.paymentMetadata.type === "zap" && amount < 0 && "Zapped "}
                    {entry.paymentMetadata.type === "zap" && amount > 0 && "Zapped by "}
                    <Name pubKey={entry.paymentMetadata.peerPubkey} />
                  </div>
                ) : (
                  <div className="font-medium">{label}</div>
                )}
                <div className="text-sm text-base-content/60">
                  {formatDate(entry.createdAt)}
                  {status && <span className="ml-2 text-warning">• Pending</span>}
                </div>
                {entry.paymentMetadata?.destination && (
                  <div className="text-sm text-base-content/60 mt-1">
                    → {entry.paymentMetadata.destination.toLowerCase().startsWith("lnurl")
                      ? entry.paymentMetadata.destination.slice(0, 20) + "..."
                      : entry.paymentMetadata.destination}
                  </div>
                )}
                {entry.paymentMetadata?.message && (
                  <div className="text-sm text-base-content/70 mt-1 italic">
                    &ldquo;{entry.paymentMetadata.message}&rdquo;
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-bold ${amount >= 0 ? "text-success" : ""}`}>
                {amount >= 0 ? "+" : ""}
                {amount} bit
              </div>
              <div className="text-xs text-base-content/60">
                {formatUsd(Math.abs(amount), usdRate)}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )

  const hasMore = displayCount < history.length

  if (hasMore) {
    return (
      <div className="space-y-2">
        <InfiniteScroll onLoadMore={handleLoadMore}>{content}</InfiniteScroll>
      </div>
    )
  }

  return <div className="space-y-2">{content}</div>
}
