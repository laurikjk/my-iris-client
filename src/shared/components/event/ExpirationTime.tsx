import {RiTimeLine} from "@remixicon/react"
import {useMemo, useEffect, useState} from "react"
import {formatExpirationTime} from "@/utils/expiration"

interface ExpirationTimeProps {
  timestamp: number
  showIcon?: boolean
  showLabel?: boolean
  className?: string
  iconSize?: "sm" | "md" // sm = w-3 h-3, md = w-4 h-4
}

/**
 * Displays expiration time with hover tooltip showing absolute time
 * Used in both note creator and feed items
 */
export function ExpirationTime({
  timestamp,
  showIcon = true,
  showLabel = true,
  className = "",
  iconSize = "sm",
}: ExpirationTimeProps) {
  const [, forceUpdate] = useState(0)

  const {relativeTime, absoluteTime, isExpired} = useMemo(() => {
    const relative = formatExpirationTime(timestamp)
    const absolute = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "long",
    }).format(timestamp * 1000) // Convert to milliseconds for Date

    return {
      relativeTime: relative,
      absoluteTime: absolute,
      isExpired: relative === "Expired",
    }
  }, [timestamp, forceUpdate]) // Include forceUpdate dependency to recalculate

  useEffect(() => {
    // Don't set up interval if already expired
    const now = Math.floor(Date.now() / 1000)
    if (timestamp <= now) return

    const timeUntilExpiry = timestamp - now
    let updateInterval: number

    // Update more frequently when close to expiry
    if (timeUntilExpiry < 60) {
      updateInterval = 1000 // Every second for last minute
    } else if (timeUntilExpiry < 3600) {
      updateInterval = 60000 // Every minute for last hour
    } else {
      updateInterval = 60000 // Every minute otherwise
    }

    const interval = setInterval(() => {
      const currentTime = Math.floor(Date.now() / 1000)
      if (currentTime >= timestamp) {
        // Just expired, update once more and clear interval
        forceUpdate((n) => n + 1)
        clearInterval(interval)
      } else {
        forceUpdate((n) => n + 1)
      }
    }, updateInterval)

    return () => clearInterval(interval)
  }, [timestamp])

  const iconClass = iconSize === "md" ? "w-4 h-4" : "w-3 h-3"

  return (
    <div
      className={`flex items-center gap-1 text-xs ${
        isExpired ? "text-error" : "text-base-content/50"
      } ${className}`}
      title={`${isExpired ? "Expired" : "Expires"}: ${absoluteTime}`}
    >
      {showIcon && <RiTimeLine className={`${iconClass} flex-shrink-0`} />}
      <span>
        {(() => {
          if (isExpired) return "Expired"
          if (showLabel) return `Expires in ${relativeTime}`
          return relativeTime
        })()}
      </span>
    </div>
  )
}
