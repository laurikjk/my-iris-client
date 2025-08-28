import {useState, useEffect} from "react"
import {RiWebhookLine} from "@remixicon/react"
import {ndk as getNdk} from "@/utils/ndk"
import {useUserStore} from "@/stores/user"
import {useUIStore} from "@/stores/ui"
import {Link} from "@/navigation"

interface RelayConnectivityIndicatorProps {
  className?: string
  showCount?: boolean
}

export const RelayConnectivityIndicator = ({
  className = "",
  showCount = true,
}: RelayConnectivityIndicatorProps) => {
  const {relayConfigs} = useUserStore()
  const {showRelayIndicator} = useUIStore()
  const [ndkRelays, setNdkRelays] = useState(new Map())

  useEffect(() => {
    const updateStats = () => {
      const ndk = getNdk()
      setNdkRelays(new Map(ndk.pool.relays))
    }

    updateStats()
    const interval = setInterval(updateStats, 2000)
    return () => clearInterval(interval)
  }, [])

  const connectedCount =
    relayConfigs?.filter((config) => {
      const relay =
        ndkRelays.get(config.url) ||
        ndkRelays.get(config.url.replace(/\/$/, "")) ||
        ndkRelays.get(config.url + "/")
      return !config.disabled && relay?.connected
    }).length || 0

  const getColorClass = () => {
    if (connectedCount === 0) return "text-error"
    if (connectedCount === 1) return "text-warning"
    return "text-neutral-500"
  }

  if (!showRelayIndicator) return null

  return (
    <Link
      to="/settings/network"
      className={`flex items-center justify-center gap-1 ${getColorClass()} ${className} hover:opacity-75 transition-opacity`}
      title={`${connectedCount} relays connected`}
    >
      <RiWebhookLine className="w-5 h-5" />
      {showCount && <span className="text-sm font-bold">{connectedCount}</span>}
    </Link>
  )
}
