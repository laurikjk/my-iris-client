import type {HistoryEntry, SendHistoryEntry} from "@/lib/cashu/core/models/History"
import {RiArrowRightUpLine, RiArrowLeftDownLine} from "@remixicon/react"
import {
  getTransactionLabel,
  getTransactionAmount,
  getTransactionStatus,
  formatDate,
  formatUsd,
} from "./utils"

interface HistoryListProps {
  history: HistoryEntry[]
  usdRate: number | null
  onSendEntryClick?: (entry: SendHistoryEntry) => void
}

export default function HistoryList({
  history,
  usdRate,
  onSendEntryClick,
}: HistoryListProps) {
  if (history.length === 0) {
    return (
      <div className="text-center text-base-content/60 py-8">No transactions yet</div>
    )
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => {
        const amount = getTransactionAmount(entry)
        const status = getTransactionStatus(entry)
        const isSend = entry.type === "send"
        const isClickable = isSend && onSendEntryClick
        return (
          <div
            key={entry.id}
            className={`flex items-center justify-between p-4 bg-base-200 rounded-lg ${
              isClickable ? "cursor-pointer hover:bg-base-300 transition-colors" : ""
            }`}
            onClick={() => {
              if (isSend && onSendEntryClick) {
                onSendEntryClick(entry as SendHistoryEntry)
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center">
                {entry.type === "mint" || entry.type === "receive" ? (
                  <RiArrowLeftDownLine className="w-5 h-5 text-success" />
                ) : (
                  <RiArrowRightUpLine className="w-5 h-5 text-error" />
                )}
              </div>
              <div>
                <div className="font-medium">{getTransactionLabel(entry)}</div>
                <div className="text-sm text-base-content/60">
                  {formatDate(entry.createdAt)}
                  {status && <span className="ml-2 text-warning">• Pending</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className={`font-bold ${
                  amount >= 0 ? "text-success" : "text-base-content"
                }`}
              >
                {amount >= 0 && "+"}
                {amount} sat
              </div>
              <div className="text-xs text-base-content/60">
                {formatUsd(Math.abs(amount), usdRate)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
