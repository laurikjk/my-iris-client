import type {HistoryEntry} from "@/lib/cashu/core/models/History"

export const formatUsd = (sats: number, usdRate: number | null): string => {
  if (!usdRate) return "$0.00"
  const btc = sats / 100000000
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

export const getTransactionLabel = (entry: HistoryEntry): string => {
  switch (entry.type) {
    case "mint":
      return "Mint"
    case "melt":
      return "Melt"
    case "send":
      return "Send"
    case "receive":
      return "Receive"
  }
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
  if (entry.type === "mint" && entry.state !== "PAID") {
    return "pending"
  }
  if (entry.type === "melt" && entry.state !== "PAID") {
    return "pending"
  }
  return null
}
