import Modal from "@/shared/components/ui/Modal"
import type {EnrichedHistoryEntry} from "../CashuWallet"
import {getTransactionAmount, formatDate, formatUsd} from "./utils"
import {Avatar} from "@/shared/components/user/Avatar"
import {Name} from "@/shared/components/user/Name"
import {RiBitCoinFill, RiFlashlightFill} from "@remixicon/react"
import {useCashuWalletStore} from "@/stores/cashuWallet"

interface TransactionDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  entry: EnrichedHistoryEntry | null
  usdRate: number | null
}

export default function TransactionDetailsModal({
  isOpen,
  onClose,
  entry,
  usdRate,
}: TransactionDetailsModalProps) {
  const {mintInfoCache} = useCashuWalletStore()

  if (!isOpen || !entry) return null

  const amount = getTransactionAmount(entry)
  const isLightning = entry.type === "mint" || entry.type === "melt"
  const isReceive = amount > 0
  const mintInfo = mintInfoCache[entry.mintUrl]?.info

  return (
    <Modal onClose={onClose}>
      <div className="p-4 min-w-[400px]">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {entry.paymentMetadata?.sender && (
                <Avatar pubKey={entry.paymentMetadata.sender} width={64} />
              )}
              {!entry.paymentMetadata?.sender && isLightning && (
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                  <RiFlashlightFill className="w-8 h-8 text-accent" />
                </div>
              )}
              {!entry.paymentMetadata?.sender && !isLightning && (
                <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center">
                  <RiBitCoinFill className="w-8 h-8 text-warning" />
                </div>
              )}
            </div>
            <h3 className="text-2xl font-bold mb-2">{isReceive ? "Received" : "Sent"}</h3>
            <div className="text-3xl font-bold">
              {amount >= 0 ? "+" : ""}
              {amount} bit
            </div>
            <div className="text-base-content/60">
              {formatUsd(Math.abs(amount), usdRate)}
            </div>
          </div>

          {/* Sender/Recipient */}
          {entry.paymentMetadata?.sender && isReceive && (
            <div>
              <h4 className="font-bold mb-2">FROM</h4>
              <div className="flex items-center gap-2">
                <Avatar pubKey={entry.paymentMetadata.sender} width={32} />
                <Name pubKey={entry.paymentMetadata.sender} />
              </div>
            </div>
          )}

          {entry.paymentMetadata?.recipient && !isReceive && (
            <div>
              <h4 className="font-bold mb-2">TO</h4>
              <div className="flex items-center gap-2">
                <Avatar pubKey={entry.paymentMetadata.recipient} width={32} />
                <Name pubKey={entry.paymentMetadata.recipient} />
              </div>
            </div>
          )}

          {/* Message */}
          {entry.paymentMetadata?.message && (
            <div>
              <h4 className="font-bold mb-2">MESSAGE</h4>
              <div className="text-sm text-base-content/80 break-words">
                &ldquo;{entry.paymentMetadata.message}&rdquo;
              </div>
            </div>
          )}

          {/* Details */}
          <div>
            <h4 className="font-bold mb-2">DETAILS</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-base-content/60">Type</span>
                <span className="text-sm font-medium">
                  {isLightning ? "Lightning" : "Ecash"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-base-content/60">Date</span>
                <span className="text-sm font-medium">{formatDate(entry.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-base-content/60">Mint</span>
                <div className="text-sm font-medium text-right truncate max-w-[200px]">
                  {mintInfo?.name || entry.mintUrl.replace(/^https?:\/\//, "")}
                </div>
              </div>
              {entry.paymentMetadata?.destination && (
                <div className="flex justify-between gap-2">
                  <span className="text-sm text-base-content/60">Destination</span>
                  <div className="text-sm font-medium text-right break-all max-w-[200px]">
                    {entry.paymentMetadata.destination.toLowerCase().startsWith("lnurl")
                      ? entry.paymentMetadata.destination.slice(0, 20) + "..."
                      : entry.paymentMetadata.destination}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button onClick={onClose} className="btn btn-ghost w-full">
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
