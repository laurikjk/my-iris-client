import {useMemo, useState, useEffect} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import Header from "@/shared/components/header/Header"
import useHistoryState from "@/shared/hooks/useHistoryState"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import Feed from "@/shared/components/feed/Feed.tsx"
import {useParams} from "react-router"
import Widget from "@/shared/components/ui/Widget"
import {DEFAULT_RELAYS} from "@/utils/ndk"
import {useSettingsStore} from "@/stores/settings"
import {Helmet} from "react-helmet"

function RelayPage() {
  const {relay} = useParams()
  const selectedRelay = relay || ""
  const relayDisplayName = selectedRelay.replace(/^(https?:\/\/)?(wss?:\/\/)?/, "")

  const [displayedRelay, setDisplayedRelay] = useState("")
  const [customRelay, setCustomRelay] = useState<string>("")
  const [showCustomInput, setShowCustomInput] = useState(false)

  const {content} = useSettingsStore()
  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useHistoryState(
    !content.hideEventsByUnknownUsers,
    "relayShowEventsByUnknownUsers"
  )

  useEffect(() => {
    setDisplayedRelay(selectedRelay || DEFAULT_RELAYS[0])
  }, [selectedRelay])

  const filters: NDKFilter = useMemo(
    () => ({
      kinds: [1],
      limit: 100,
    }),
    []
  )

  const handleAddCustomRelay = () => {
    if (customRelay.trim()) {
      const newRelay = customRelay.startsWith("wss://") ? customRelay : `wss://${customRelay}`
      window.location.href = `/relay/${encodeURIComponent(newRelay)}`
    }
  }

  const relayOptions = [...DEFAULT_RELAYS, ...(selectedRelay && !DEFAULT_RELAYS.includes(selectedRelay) ? [selectedRelay] : [])]

  // Simple relay URL normalization for comparison
  const normalizeRelay = (url: string) => url.replace(/^(https?:\/\/)?(wss?:\/\/)?/, "").replace(/\/$/, "")

  return (
    <div className="flex flex-row">
      <div className="flex flex-col items-center flex-1">
        <Header title={selectedRelay ? `Relay: ${relayDisplayName}` : "Relay Feed"} />
        <div className="p-2 flex-1 w-full max-w-screen-lg flex flex-col gap-4">
          <div className="flex gap-2 flex-wrap">
            <select
              className="select select-bordered flex-1"
              value={displayedRelay}
              onChange={(e) => {
                const newRelay = e.target.value
                if (newRelay === "custom") {
                  setShowCustomInput(true)
                } else {
                  window.location.href = `/relay/${encodeURIComponent(newRelay)}`
                }
              }}
            >
              <option value="">Select a relay</option>
              {relayOptions.map((relay) => (
                <option key={relay} value={relay}>
                  {relay.replace(/^(https?:\/\/)?(wss?:\/\/)?/, "")}
                </option>
              ))}
              <option value="custom">Add custom relay...</option>
            </select>
          </div>

          {showCustomInput && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="wss://relay.example.com"
                value={customRelay}
                onChange={(e) => setCustomRelay(e.target.value)}
                className="input input-bordered flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddCustomRelay()
                  }
                }}
              />
              <button onClick={handleAddCustomRelay} className="btn btn-primary">
                Go
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false)
                  setCustomRelay("")
                }}
                className="btn btn-neutral"
              >
                Cancel
              </button>
            </div>
          )}

          {selectedRelay && (
            <>
              <div className="flex items-center gap-2 p-2">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={showEventsByUnknownUsers}
                  onChange={(e) => setShowEventsByUnknownUsers(e.target.checked)}
                />
                <span className="text-sm">Show posts from unknown users</span>
              </div>

              <Feed
                key={selectedRelay}
                filters={filters}
                showRepliedTo={false}
                cacheKey={`relay-${selectedRelay}`}
                relayUrls={[selectedRelay]}
                showEventsByUnknownUsers={showEventsByUnknownUsers}
                displayFilterFn={(event) => {
                  if (!event.onRelays || event.onRelays.length === 0) return false

                  const normalizedSelectedRelay = normalizeRelay(selectedRelay)
                  return event.onRelays.some(
                    (relay) => normalizeRelay(relay.url) === normalizedSelectedRelay
                  )
                }}
              />
            </>
          )}

          {!selectedRelay && (
            <div className="text-center py-8 text-base-content/50">
              Select a relay to view its feed
            </div>
          )}

          <div className="mt-8">
            <PopularFeed small={false} />
          </div>
        </div>
        <Helmet>
          <title>{selectedRelay ? `Relay: ${relayDisplayName}` : "Relay Feed"} / Iris</title>
        </Helmet>
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular">
              <PopularFeed />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}

export default RelayPage
