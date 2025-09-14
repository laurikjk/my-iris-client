import {useEffect} from "react"
import {useParams, useNavigate} from "@/navigation"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import RelaySelector from "@/shared/components/ui/RelaySelector"
import RelayDetails from "@/shared/components/relay/RelayDetails"
import {useSearchStore} from "@/stores/search"

export default function RelayFilters() {
  const {url} = useParams()
  const navigate = useNavigate()
  const decodedRelay = url ? decodeURIComponent(url) : ""
  const urlRelayUrl = decodedRelay ? `wss://${decodedRelay}` : ""

  // Use store for persistent state
  const storedRelayUrl = useSearchStore((state) => state.selectedRelayUrl)
  const setStoredRelayUrl = useSearchStore((state) => state.setSelectedRelayUrl)
  const showEventsByUnknownUsers = useSearchStore(
    (state) => state.showEventsByUnknownUsers
  )
  const setShowEventsByUnknownUsers = useSearchStore(
    (state) => state.setShowEventsByUnknownUsers
  )

  // Use URL if provided, otherwise use stored value
  const selectedRelayUrl = urlRelayUrl || storedRelayUrl

  // Update stored relay when URL changes
  useEffect(() => {
    if (urlRelayUrl) {
      setStoredRelayUrl(urlRelayUrl)
    }
  }, [urlRelayUrl, setStoredRelayUrl])

  return (
    <div className="flex flex-col gap-2 h-full">
      <SearchTabSelector activeTab="relay" />

      <div className="p-2">
        <RelaySelector
          selectedRelay={selectedRelayUrl}
          onRelaySelect={(newRelay) => {
            setStoredRelayUrl(newRelay)
            const cleanUrl = newRelay
              .replace(/^(https?:\/\/)?(wss?:\/\/)?/, "")
              .replace(/\/$/, "") // Remove trailing slash
            navigate(`/relay/${encodeURIComponent(cleanUrl)}`, {replace: true})
          }}
          placeholder="Select a relay"
        />
      </div>

      {selectedRelayUrl && (
        <>
          <div className="px-2">
            <RelayDetails relayUrl={selectedRelayUrl} />
          </div>

          <div className="flex items-center gap-2 p-2">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={showEventsByUnknownUsers}
              onChange={(e) => setShowEventsByUnknownUsers(e.target.checked)}
            />
            <span className="text-sm">Show posts from unknown users</span>
          </div>
        </>
      )}
    </div>
  )
}
