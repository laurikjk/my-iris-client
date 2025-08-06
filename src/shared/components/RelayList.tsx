import {useState, useEffect} from "react"
import {ndk as getNdk} from "@/utils/ndk"
import {Link} from "@/navigation"
import {
  RiAddLine,
  RiCloseLine,
  RiLinkM,
  RiLinkUnlinkM,
  RiDeleteBinLine,
} from "@remixicon/react"
import {useUserStore, RelayConfig} from "@/stores/user"

interface RelayListProps {
  compact?: boolean
  showDelete?: boolean
  showAddRelay?: boolean
  showDiscovered?: boolean
  className?: string
  itemClassName?: string
  maxHeight?: string
}

export function RelayList({
  compact = false,
  showDelete = false,
  showAddRelay = true,
  showDiscovered = false,
  className = "",
  itemClassName = "",
  maxHeight = "max-h-64",
}: RelayListProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customRelay, setCustomRelay] = useState("")
  const [showDiscoveredRelays, setShowDiscoveredRelays] = useState(false)
  const {relayConfigs, toggleRelayConnection, addRelay, removeRelay} = useUserStore()
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

  // Sort relays by enabled status, then connection status, then alphabetically
  const sortedRelayConfigs = [...(relayConfigs || [])].sort((a, b) => {
    const relayA =
      ndkRelays.get(a.url) ||
      ndkRelays.get(a.url.replace(/\/$/, "")) ||
      ndkRelays.get(a.url + "/")
    const relayB =
      ndkRelays.get(b.url) ||
      ndkRelays.get(b.url.replace(/\/$/, "")) ||
      ndkRelays.get(b.url + "/")

    // Sort by enabled+connected, enabled, disabled
    const statusA = !a.disabled && relayA?.connected ? 2 : !a.disabled ? 1 : 0
    const statusB = !b.disabled && relayB?.connected ? 2 : !b.disabled ? 1 : 0
    const statusDiff = statusB - statusA

    if (statusDiff !== 0) return statusDiff

    // Secondary sort by URL alphabetically
    return a.url.localeCompare(b.url)
  })

  const handleAddCustomRelay = () => {
    if (customRelay.trim()) {
      let url = customRelay.trim()
      if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
        url = `wss://${url}`
      }
      // Ensure trailing slash for consistency with NDK normalization
      if (!url.endsWith("/")) {
        url = url + "/"
      }

      // Check if relay already exists
      if (!relayConfigs?.some((c) => c.url === url)) {
        addRelay(url, false) // false = not disabled (enabled)
      }

      setCustomRelay("")
      setShowCustomInput(false)
    }
  }

  const getRelay = (config: RelayConfig) => {
    let relay = ndkRelays.get(config.url)
    if (!relay && !config.url.endsWith("/")) {
      relay = ndkRelays.get(config.url + "/")
    }
    if (!relay && config.url.endsWith("/")) {
      relay = ndkRelays.get(config.url.slice(0, -1))
    }
    return relay
  }

  const iconSize = compact ? "w-3 h-3" : "w-5 h-5"
  const textSize = compact ? "text-xs" : "text-lg"
  const padding = compact ? "py-0.5" : "py-2"
  const buttonPadding = compact ? "p-0.5" : "p-1"

  return (
    <div className={className}>
      <div
        className={`${compact ? "space-y-0.5" : "divide-y divide-base-300"} ${maxHeight} overflow-y-auto ${compact ? "pr-1" : ""}`}
      >
        {showAddRelay && (
          <>
            {!showCustomInput ? (
              <button
                onClick={() => setShowCustomInput(true)}
                className={`flex items-center gap-2 ${textSize} hover:opacity-100 transition-opacity group ${padding} w-full text-left link link-info`}
              >
                <RiAddLine className={`${iconSize} flex-shrink-0`} />
                <span>Add relay</span>
              </button>
            ) : (
              <div className={`flex gap-1 items-center ${compact ? "mb-1" : "pb-2"}`}>
                <input
                  type="text"
                  placeholder="wss://relay.example.com"
                  value={customRelay}
                  onChange={(e) => setCustomRelay(e.target.value)}
                  className={`input ${compact ? "input-xs" : "input-sm"} flex-1 ${textSize}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddCustomRelay()
                    } else if (e.key === "Escape") {
                      setShowCustomInput(false)
                      setCustomRelay("")
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={handleAddCustomRelay}
                  className={`btn ${compact ? "btn-xs" : "btn-sm"} btn-primary px-2`}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowCustomInput(false)
                    setCustomRelay("")
                  }}
                  className={`btn ${compact ? "btn-xs" : "btn-sm"} btn-ghost ${buttonPadding}`}
                >
                  <RiCloseLine className={iconSize} />
                </button>
              </div>
            )}
          </>
        )}

        {sortedRelayConfigs.map((config) => {
          const relay = getRelay(config)
          const isEnabled = !config.disabled
          const isConnected = isEnabled && relay?.connected
          const displayUrl = config.url.replace(/^wss?:\/\//, "").replace(/\/$/, "")

          return (
            <div
              key={config.url}
              className={`flex items-center justify-between ${padding} ${itemClassName}`}
            >
              <Link
                to={`/relay/${encodeURIComponent(displayUrl)}`}
                className={`${textSize} font-medium link link-info flex-1 ${
                  compact ? (isEnabled ? "opacity-80" : "opacity-40") : ""
                }`}
              >
                {displayUrl}
              </Link>
              <div className={`flex items-center ${compact ? "gap-2" : "gap-4"}`}>
                <button
                  onClick={() => toggleRelayConnection(config.url)}
                  className={`${buttonPadding} hover:bg-base-${compact ? "300" : "200"} rounded transition-colors flex-shrink-0`}
                  title={isEnabled ? "Disconnect from relay" : "Connect to relay"}
                >
                  {isEnabled ? (
                    <RiLinkUnlinkM className={`${iconSize} text-error`} />
                  ) : (
                    <RiLinkM className={`${iconSize} text-success`} />
                  )}
                </button>
                {showDelete && (
                  <RiDeleteBinLine
                    className={`${iconSize} cursor-pointer`}
                    onClick={() => removeRelay(config.url)}
                  />
                )}
                {compact ? (
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isConnected ? "bg-success" : isEnabled ? "bg-warning" : "bg-error"
                    }`}
                  />
                ) : (
                  <span
                    className={`badge ${
                      isConnected
                        ? "badge-success"
                        : isEnabled
                          ? "badge-warning"
                          : "badge-error"
                    }`}
                  ></span>
                )}
              </div>
            </div>
          )
        })}

        {showDiscovered && (
          <>
            <button
              onClick={() => setShowDiscoveredRelays(!showDiscoveredRelays)}
              className={`flex items-center gap-2 ${textSize} hover:opacity-100 transition-opacity group ${padding} w-full text-left text-base-content/60 hover:underline`}
            >
              <span>
                {showDiscoveredRelays ? "▼" : "▶"} Discovered relays (
                {ndkRelays.size - sortedRelayConfigs.length})
              </span>
            </button>

            {showDiscoveredRelays && (
              <>
                {Array.from(ndkRelays.entries())
                  .filter(([url]) => {
                    // Filter out relays that are already in user's configs
                    return !relayConfigs?.some(
                      (c) =>
                        c.url === url ||
                        c.url === url + "/" ||
                        c.url === url.replace(/\/$/, "")
                    )
                  })
                  .sort(([urlA, relayA], [urlB, relayB]) => {
                    // Sort by connection status, then alphabetically
                    if (relayA.connected !== relayB.connected) {
                      return relayA.connected ? -1 : 1
                    }
                    return urlA.localeCompare(urlB)
                  })
                  .map(([url, relay]) => {
                    const displayUrl = url.replace(/^wss?:\/\//, "").replace(/\/$/, "")
                    return (
                      <div
                        key={url}
                        className={`flex items-center justify-between ${padding} ${itemClassName} opacity-60`}
                      >
                        <Link
                          to={`/relay/${encodeURIComponent(displayUrl)}`}
                          className={`${textSize} font-medium link link-info flex-1`}
                        >
                          {displayUrl}
                        </Link>
                        <div
                          className={`flex items-center ${compact ? "gap-2" : "gap-4"}`}
                        >
                          <button
                            onClick={() => addRelay(url, false)}
                            className={`${buttonPadding} hover:bg-base-${compact ? "300" : "200"} rounded transition-colors flex-shrink-0`}
                            title="Add to your relays"
                          >
                            <RiAddLine className={`${iconSize} text-success`} />
                          </button>
                          {compact ? (
                            <div
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                relay.connected ? "bg-success" : "bg-base-300"
                              }`}
                            />
                          ) : (
                            <span
                              className={`badge ${
                                relay.connected ? "badge-success" : "badge-ghost"
                              }`}
                            ></span>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
