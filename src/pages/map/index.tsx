import {useState, useEffect} from "react"
import {useParams} from "@/navigation"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import Feed from "@/shared/components/feed/Feed"
import FeedEditor from "@/shared/components/feed/FeedEditor"
import {GeohashField} from "@/shared/components/feed/FeedEditor/GeohashField"
import {FollowDistanceField} from "@/shared/components/feed/FeedEditor/FollowDistanceField"
import EventKindsSelector from "@/shared/components/ui/EventKindsSelector"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"
import type {FeedConfig, FeedFilter} from "@/types/feed"
import {KIND_TEXT_NOTE, KIND_EPHEMERAL} from "@/utils/constants"

export default function MapPage() {
  const {geohash} = useParams()
  const [showMoreSettings, setShowMoreSettings] = useState(false)
  const [feedConfig, setFeedConfig] = useState<FeedConfig | null>(null)
  const [feedKey, setFeedKey] = useState(0)
  const [feedEvents, setFeedEvents] = useState<NDKEvent[]>([])

  useEffect(() => {
    // Only set initial config, don't override user selections
    if (feedConfig !== null) return

    // Create a feed config - with or without specific geohash
    const geohashValue = geohash && typeof geohash === "string" ? geohash : ""

    // If no geohash specified, use all single-character geohashes
    const allGeohashes = "0123456789bcdefghjkmnpqrstuvwxyz".split("")
    const defaultGeohashes = geohashValue ? [geohashValue] : allGeohashes

    setFeedConfig({
      id: geohashValue ? `geohash-${geohashValue}` : "geohash-global",
      name: geohashValue ? `Location: ${geohashValue}` : "Location Feed",
      filter: {
        kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL], // Text notes and ephemeral events for geohash feeds
        "#g": defaultGeohashes, // Always include geohash filter
        limit: 100,
      },
      followDistance: 5, // Default follow distance of 5 for geohash feeds
      showRepliedTo: true,
      hideReplies: false,
    })
  }, [geohash, feedConfig])

  if (!feedConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    )
  }

  const handleConfigUpdate = (updatedConfig: FeedConfig) => {
    setFeedConfig(updatedConfig)
    // Clear events when config changes
    setFeedEvents([])
    // Force Feed component to remount with new config
    setFeedKey((prev) => prev + 1)

    // Update URL based on selection
    const geohashes = updatedConfig.filter?.["#g"]
    const allGeohashes = "0123456789bcdefghjkmnpqrstuvwxyz".split("")
    const isGlobalSelection =
      geohashes &&
      geohashes.length === 32 &&
      allGeohashes.every((gh) => geohashes.includes(gh))

    if (geohashes && geohashes.length === 1 && !isGlobalSelection) {
      // Single geohash selected (not global) - update URL
      const newPath = `/map/${geohashes[0]}`
      window.history.replaceState(null, "", newPath)
    } else if (isGlobalSelection) {
      // Global view - remove geohash from URL
      window.history.replaceState(null, "", "/map")
    }
    // For other cases (multiple non-global selections), keep current URL
  }

  const updateFilter = <K extends keyof FeedFilter>(key: K, value: FeedFilter[K]) => {
    if (!feedConfig) return
    const currentFilter = feedConfig.filter || {}
    const allGeohashes = "0123456789bcdefghjkmnpqrstuvwxyz".split("")

    // Only reset to all geohashes if explicitly cleared in map view
    if (
      key === "#g" &&
      (value === undefined || (Array.isArray(value) && value.length === 0))
    ) {
      // For geohash filter in map view, use all geohashes when cleared
      handleConfigUpdate({
        ...feedConfig,
        filter: {...currentFilter, "#g": allGeohashes},
      })
    } else if (value === undefined) {
      // Remove the key if value is undefined for other filters
      const newFilter = {...currentFilter}
      delete newFilter[key]
      handleConfigUpdate({
        ...feedConfig,
        filter: Object.keys(newFilter).length > 0 ? newFilter : undefined,
      })
    } else {
      // Normal update - just set the value
      handleConfigUpdate({
        ...feedConfig,
        filter: {...currentFilter, [key]: value},
      })
    }
  }

  return (
    <div className="flex flex-col flex-1 h-full relative overflow-hidden">
      <Header title={geohash ? `Location: ${geohash}` : "Location Feed"} />
      <ScrollablePageContainer className="flex flex-col items-center">
        <div className="flex-1 w-full flex flex-col overflow-x-hidden">
          {/* Full width map at the top of the column */}
          <GeohashMap
            geohashes={feedConfig.filter?.["#g"]}
            feedEvents={feedEvents}
            onGeohashSelect={(geohash) => {
              // Replace selection instead of adding to it (ensure lowercase)
              updateFilter("#g", [geohash.toLowerCase()])
            }}
            height="20rem"
            className="w-full"
          />

          <div className="p-2 flex flex-col gap-4 md:pt-2">
            {/* Show either inline controls or full editor */}
            {showMoreSettings ? (
              <FeedEditor
                feedConfig={feedConfig}
                onConfigChange={handleConfigUpdate}
                onClose={() => setShowMoreSettings(false)}
                showDeleteButton={false}
                showResetButton={false}
                showCloneButton={false}
              />
            ) : (
              <div className="w-full flex flex-col gap-3 p-4 border border-base-300 rounded-lg">
                <GeohashField
                  value={feedConfig.filter?.["#g"]}
                  onChange={(value) => updateFilter("#g", value)}
                  showLabel={true}
                />

                <div className="flex items-start gap-2 overflow-hidden">
                  <span className="text-sm text-base-content/70 min-w-[7rem] pt-2 flex-shrink-0">
                    Event Kinds
                  </span>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <EventKindsSelector
                      selectedKinds={feedConfig.filter?.kinds || []}
                      onKindsChange={(kinds) =>
                        updateFilter("kinds", kinds.length > 0 ? kinds : undefined)
                      }
                    />
                    <span className="text-xs text-base-content/50 mt-1 block">
                      Select event types to include in this feed. Select none to display
                      all.
                    </span>
                  </div>
                </div>

                <FollowDistanceField
                  value={feedConfig.followDistance}
                  onChange={(value) =>
                    handleConfigUpdate({...feedConfig, followDistance: value})
                  }
                  showLabel={true}
                />

                {/* More settings button */}
                <div className="flex items-center gap-2 pt-2 border-t border-base-300">
                  <button
                    onClick={() => setShowMoreSettings(true)}
                    className="btn btn-sm btn-neutral"
                    title="Show advanced settings"
                  >
                    More Settings
                  </button>
                </div>
              </div>
            )}

            {/* Feed */}
            <Feed
              key={feedKey}
              feedConfig={feedConfig}
              showReplies={0}
              borderTopFirst={true}
              showDisplayAsSelector={true}
              onEvent={(event) => {
                // Collect events for the map
                setFeedEvents((prev) => {
                  // Avoid duplicates
                  if (prev.some((e) => e.id === event.id)) return prev
                  // Keep last 100 events
                  return [...prev.slice(-99), event]
                })
              }}
            />
          </div>
        </div>
      </ScrollablePageContainer>
    </div>
  )
}
