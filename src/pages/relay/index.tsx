import {useMemo, useState, useEffect} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import Header from "@/shared/components/header/Header"
import useHistoryState from "@/shared/hooks/useHistoryState"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import Feed from "@/shared/components/feed/Feed.tsx"
import {useParams} from "react-router"
import Widget from "@/shared/components/ui/Widget"
import {useSettingsStore} from "@/stores/settings"
import {Helmet} from "react-helmet"
import RelaySelector from "@/shared/components/ui/RelaySelector"
import {KIND_TEXT_NOTE} from "@/utils/constants"

function RelayPage() {
  const {url} = useParams()
  const decodedRelay = url ? decodeURIComponent(url) : ""
  const initialRelayUrl = decodedRelay ? `wss://${decodedRelay}` : ""
  const relayDisplayName = decodedRelay || ""

  const [selectedRelayUrl, setSelectedRelayUrl] = useState(initialRelayUrl)

  // Update selectedRelayUrl when the URL changes
  useEffect(() => {
    setSelectedRelayUrl(initialRelayUrl)
  }, [initialRelayUrl])

  const {content} = useSettingsStore()
  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useHistoryState(
    !content.hideEventsByUnknownUsers,
    "relayShowEventsByUnknownUsers"
  )

  const filters: NDKFilter = useMemo(
    () => ({
      kinds: [KIND_TEXT_NOTE],
      limit: 100,
    }),
    []
  )

  return (
    <div className="flex flex-row">
      <div className="flex flex-col items-center flex-1">
        <Header title={decodedRelay ? `Relay: ${relayDisplayName}` : "Relay Feed"} />
        <div className="p-2 flex-1 w-full max-w-screen-lg flex flex-col gap-4">
          <RelaySelector
            selectedRelay={selectedRelayUrl}
            onRelaySelect={(newRelay) => {
              setSelectedRelayUrl(newRelay)
              const cleanUrl = newRelay.replace(/^(https?:\/\/)?(wss?:\/\/)?/, "")
              window.location.href = `/relay/${encodeURIComponent(cleanUrl)}`
            }}
            placeholder="Select a relay"
          />

          {selectedRelayUrl && (
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
                key={selectedRelayUrl}
                feedConfig={{
                  name: "Relay Feed",
                  id: `relay-${selectedRelayUrl}`,
                  showRepliedTo: true,
                  showEventsByUnknownUsers: showEventsByUnknownUsers,
                  sortType: "chronological",
                  relayUrls: [selectedRelayUrl],
                  filter: filters,
                }}
              />
            </>
          )}

          {!selectedRelayUrl && (
            <div className="text-center py-8 text-base-content/50">
              Select a relay to view its feed
            </div>
          )}
        </div>
        <Helmet>
          <title>
            {decodedRelay ? `Relay: ${relayDisplayName}` : "Relay Feed"} / Iris
          </title>
        </Helmet>
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular">
              <AlgorithmicFeed
                type="popular"
                displayOptions={{
                  small: true,
                  showDisplaySelector: false,
                  randomSort: true,
                }}
              />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}

export default RelayPage
