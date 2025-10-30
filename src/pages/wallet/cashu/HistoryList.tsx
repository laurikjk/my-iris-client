import type {SendHistoryEntry, HistoryEntry} from "@/lib/cashu/core/models/History"
import type {EnrichedHistoryEntry} from "../hooks/useHistoryEnrichment"
import {RiFlashlightFill, RiBitCoinFill} from "@remixicon/react"
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
  onMintEntryClick?: (entry: HistoryEntry) => void
  onReceiveEntryClick?: (entry: HistoryEntry) => void
}

export default function HistoryList({
  history,
  usdRate,
  onSendEntryClick,
  onMintEntryClick,
  onReceiveEntryClick,
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
        const isReceive = entry.type === "receive" || (entry.type === "mint" && !status)
        const isPendingMint = entry.type === "mint" && status === "pending"
        const isZapWithEvent =
          entry.paymentMetadata?.type === "zap" && entry.paymentMetadata?.eventId
        const hasRecipient = !!entry.paymentMetadata?.recipient
        const hasSender = !!entry.paymentMetadata?.sender
        const isClickable =
          (isSend && onSendEntryClick) ||
          (isReceive && onReceiveEntryClick) ||
          (isPendingMint && onMintEntryClick) ||
          isZapWithEvent ||
          hasRecipient ||
          hasSender

        // Determine if it's Lightning (mint/melt) or Ecash (send/receive)
        const label =
          entry.type === "mint" || entry.type === "melt" ? "Lightning" : "Ecash"

        const handleClick = () => {
          if (isPendingMint && onMintEntryClick) {
            onMintEntryClick(entry)
          } else if (
            isReceive &&
            onReceiveEntryClick &&
            !hasRecipient &&
            !hasSender &&
            !isZapWithEvent
          ) {
            // Settled receives without recipient/sender metadata - show details
            onReceiveEntryClick(entry)
          } else if (isZapWithEvent && entry.paymentMetadata?.eventId) {
            navigate(`/${nip19.noteEncode(entry.paymentMetadata.eventId)}`)
          } else if (hasRecipient && entry.paymentMetadata?.recipient) {
            // Lightning payments (melt): Navigate to profile
            // Ecash sends: Navigate to DM
            if (entry.type === "melt") {
              navigate(`/${nip19.npubEncode(entry.paymentMetadata.recipient)}`)
            } else {
              navigate("/chats/chat", {
                state: {id: entry.paymentMetadata.recipient},
              })
            }
          } else if (hasSender && entry.paymentMetadata?.sender) {
            // Lightning receives (mint): Navigate to profile
            // Ecash receives: Navigate to DM
            if (entry.type === "mint") {
              navigate(`/${nip19.npubEncode(entry.paymentMetadata.sender)}`)
            } else {
              navigate("/chats/chat", {
                state: {id: entry.paymentMetadata.sender},
              })
            }
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
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0">
                {(entry.paymentMetadata?.recipient || entry.paymentMetadata?.sender) && (
                  <Avatar
                    pubKey={
                      amount < 0
                        ? entry.paymentMetadata.recipient!
                        : entry.paymentMetadata.sender!
                    }
                    width={32}
                  />
                )}
                {!entry.paymentMetadata?.recipient &&
                  !entry.paymentMetadata?.sender &&
                  label === "Lightning" && (
                    <RiFlashlightFill className="w-5 h-5 text-accent" />
                  )}
                {!entry.paymentMetadata?.recipient &&
                  !entry.paymentMetadata?.sender &&
                  label !== "Lightning" && (
                    <RiBitCoinFill className="w-5 h-5 text-warning" />
                  )}
              </div>
              <div className="min-w-0 flex-1">
                {entry.paymentMetadata?.recipient || entry.paymentMetadata?.sender ? (
                  <div className="font-medium truncate">
                    {entry.paymentMetadata.type === "zap" && amount < 0 && "Zapped "}
                    {entry.paymentMetadata.type === "zap" && amount > 0 && "Zapped by "}
                    {entry.paymentMetadata.type !== "zap" && amount < 0 && "Sent to "}
                    {entry.paymentMetadata.type !== "zap" &&
                      amount > 0 &&
                      "Received from "}
                    <Name
                      pubKey={
                        amount < 0
                          ? entry.paymentMetadata.recipient!
                          : entry.paymentMetadata.sender!
                      }
                    />
                  </div>
                ) : (
                  <div className="font-medium truncate">{label}</div>
                )}
                <div className="text-sm text-base-content/60 truncate">
                  {formatDate(entry.createdAt)}
                  {status && <span className="ml-2 text-warning">• Pending</span>}
                </div>
                {entry.paymentMetadata?.destination && (
                  <div
                    className="text-sm text-base-content/60 mt-1 break-words"
                    style={{overflowWrap: "anywhere"}}
                  >
                    →{" "}
                    {entry.paymentMetadata.destination.toLowerCase().startsWith("lnurl")
                      ? entry.paymentMetadata.destination.slice(0, 20) + "..."
                      : entry.paymentMetadata.destination}
                  </div>
                )}
                {entry.paymentMetadata?.message && (
                  <div
                    className="text-sm text-base-content/70 mt-1 italic break-words"
                    style={{overflowWrap: "anywhere"}}
                  >
                    &ldquo;{entry.paymentMetadata.message}&rdquo;
                  </div>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div
                className={`font-bold whitespace-nowrap ${amount >= 0 && !status ? "text-success" : ""}`}
              >
                {amount >= 0 ? "+" : ""}
                {amount} bit
              </div>
              <div className="text-xs text-base-content/60 whitespace-nowrap">
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
