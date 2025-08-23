import {useState, useEffect} from "react"
import {useParams} from "@/navigation"
import Feed from "@/shared/components/feed/Feed"
import FeedEditor from "@/shared/components/feed/FeedEditor"
import {GeohashField} from "@/shared/components/feed/FeedEditor/GeohashField"
import {FollowDistanceField} from "@/shared/components/feed/FeedEditor/FollowDistanceField"
import EventKindsSelector from "@/shared/components/ui/EventKindsSelector"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import type {FeedConfig, FeedFilter} from "@/types/feed"
import {KIND_TEXT_NOTE, KIND_EPHEMERAL} from "@/utils/constants"

export default function GeohashPage() {
  const {geohash} = useParams()
  const [showMoreSettings, setShowMoreSettings] = useState(false)
  const [feedConfig, setFeedConfig] = useState<FeedConfig | null>(null)
  const [feedKey, setFeedKey] = useState(0)

  useEffect(() => {
    // Create a feed config - with or without specific geohash
    const geohashValue = geohash && typeof geohash === "string" ? geohash : ""
    setFeedConfig({
      id: geohashValue ? `geohash-${geohashValue}` : "geohash-global",
      name: geohashValue ? `Location: ${geohashValue}` : "Location Feed",
      filter: {
        kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL], // Text notes and ephemeral events for geohash feeds
        ...(geohashValue ? {"#g": [geohashValue]} : {}), // Only add geohash filter if provided
        limit: 100,
      },
      followDistance: 5, // Default follow distance of 5 for geohash feeds
      showRepliedTo: true,
      hideReplies: false,
    })
  }, [geohash])

  if (!feedConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    )
  }

  const handleConfigUpdate = (updatedConfig: FeedConfig) => {
    setFeedConfig(updatedConfig)
    // Force Feed component to remount with new config
    setFeedKey((prev) => prev + 1)
  }

  const updateFilter = <K extends keyof FeedFilter>(key: K, value: FeedFilter[K]) => {
    if (!feedConfig) return
    const currentFilter = feedConfig.filter || {}

    if (value === undefined) {
      // Remove the key if value is undefined
      const newFilter = {...currentFilter}
      delete newFilter[key]
      handleConfigUpdate({
        ...feedConfig,
        filter: Object.keys(newFilter).length > 0 ? newFilter : undefined,
      })
    } else {
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
        <div className="p-2 flex-1 w-full max-w-screen-lg flex flex-col gap-4 md:pt-2 overflow-x-hidden">
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
          {!showMoreSettings && (
            <Feed
              key={feedKey}
              feedConfig={feedConfig}
              showReplies={0}
              borderTopFirst={true}
              showDisplayAsSelector={true}
            />
          )}
        </div>
      </ScrollablePageContainer>
    </div>
  )
}
