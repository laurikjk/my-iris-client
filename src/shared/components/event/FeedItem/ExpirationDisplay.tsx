import {NDKEvent} from "@/lib/ndk"
import {ExpirationTime} from "@/shared/components/event/ExpirationTime"

interface ExpirationDisplayProps {
  event: NDKEvent
  className?: string
}

export function ExpirationDisplay({event, className = ""}: ExpirationDisplayProps) {
  const expirationTag = event.tags.find((tag) => tag[0] === "expiration" && tag[1])

  if (!expirationTag) return null

  const expirationTimestamp = parseInt(expirationTag[1], 10)
  if (isNaN(expirationTimestamp)) return null

  return <ExpirationTime timestamp={expirationTimestamp} className={className} />
}
