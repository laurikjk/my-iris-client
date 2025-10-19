import type {HistoryEntry} from "@/lib/cashu/core/models/History"

export const formatUsd = (bits: number, usdRate: number | null): string => {
  if (!usdRate) return "$0.00"
  const btc = bits / 100000000
  const usd = btc * usdRate
  return `$${usd.toFixed(2)}`
}

export const formatDate = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

export const getTransactionAmount = (entry: HistoryEntry): number => {
  switch (entry.type) {
    case "mint":
      return entry.amount
    case "melt":
      return -entry.amount
    case "send":
      return -entry.amount
    case "receive":
      return entry.amount
  }
}

export const getTransactionStatus = (entry: HistoryEntry): string | null => {
  // Mint states: UNPAID | ISSUED | PAID
  // Only show pending if UNPAID (not yet paid on Lightning)
  if (entry.type === "mint" && entry.state === "UNPAID") {
    return "pending"
  }
  // Melt states: UNPAID | PENDING | PAID
  // Show pending if not yet completed
  if (entry.type === "melt" && (entry.state === "UNPAID" || entry.state === "PENDING")) {
    return "pending"
  }
  return null
}
