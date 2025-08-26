export const EXPIRATION_OPTIONS = [
  {label: "5 minutes", value: 5 * 60},
  {label: "1 hour", value: 60 * 60},
  {label: "24 hours", value: 24 * 60 * 60},
  {label: "1 week", value: 7 * 24 * 60 * 60},
  {label: "1 month", value: 30 * 24 * 60 * 60},
  {label: "3 months", value: 90 * 24 * 60 * 60},
]

/**
 * Get label for a specific expiration delta
 * @param delta - Expiration delta in seconds
 * @returns Label string or formatted time if not in preset options
 */
export function getExpirationLabel(delta: number): string {
  const option = EXPIRATION_OPTIONS.find((opt) => opt.value === delta)
  if (option) return option.label

  // Format custom values
  const minute = 60
  const hour = minute * 60
  const day = hour * 24

  if (delta < minute) return `${delta} seconds`
  if (delta < hour) return `${Math.floor(delta / minute)} minutes`
  if (delta < day) return `${Math.floor(delta / hour)} hours`
  return `${Math.floor(delta / day)} days`
}

/**
 * Format future expiration time into a human-readable relative time string
 * @param expirationTimestamp - Unix timestamp in seconds (future time)
 * @returns Human-readable time string (e.g., "24h", "7d", "3mo") or "Expired" if in past
 */
export function formatExpirationTime(expirationTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = expirationTimestamp - now

  if (diff <= 0) return "Expired"

  const minute = 60
  const hour = minute * 60
  const day = hour * 24
  const week = day * 7
  const month = day * 30

  // Use more accurate rounding thresholds
  if (diff < minute) return `${diff}s`
  if (diff < hour) return `${Math.floor(diff / minute)}m`
  if (diff < day * 1.5) return `${Math.round(diff / hour)}h`
  if (diff < week * 1.5) return `${Math.round(diff / day)}d`
  if (diff < month * 2.5) return `${Math.round(diff / week)}w`
  return `${Math.round(diff / month)}mo`
}

/**
 * Get expiration info including formatted text and expired status
 * @param expirationTimestamp - Unix timestamp in seconds
 * @returns Object with text and expired status, or null if invalid
 */
export function getExpirationInfo(
  expirationTimestamp: number | undefined | null
): {text: string; expired: boolean} | null {
  if (!expirationTimestamp || isNaN(expirationTimestamp)) return null

  const now = Math.floor(Date.now() / 1000)
  const expired = expirationTimestamp <= now
  const text = formatExpirationTime(expirationTimestamp)

  return {text, expired}
}
