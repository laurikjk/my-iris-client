import React from "react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useFeedStore, useEnabledFeedIds} from "@/stores/feed"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiEqualizerFill,
  RiAddLine,
} from "@remixicon/react"

interface FeedTab {
  name: string
  id: string
  showRepliedTo?: boolean
  fetchFilterFn?: (e: NDKEvent) => boolean
  filter?: {
    kinds?: number[]
    since?: number
    limit?: number
  }
  displayFilterFn?: (e: NDKEvent) => boolean
  sortLikedPosts?: boolean
}

interface FeedTabsProps {
  allTabs: FeedTab[]
  editMode: boolean
  onEditModeToggle: () => void
}

function FeedTabs({allTabs, editMode, onEditModeToggle}: FeedTabsProps) {
  const {
    activeHomeTab: activeTab,
    setActiveHomeTab: setActiveTab,
    reorderFeeds,
    saveFeedConfig,
    loadFeedConfig,
    setEnabledFeedIds,
  } = useFeedStore()
  const enabledFeedIds = useEnabledFeedIds()

  // Filter and order tabs based on enabled feed IDs from store
  const tabs = React.useMemo(() => {
    const tabsMap = new Map(allTabs.map((tab) => [tab.id, tab]))
    return enabledFeedIds
      .map((id) => tabsMap.get(id))
      .filter((tab): tab is FeedTab => tab !== undefined)
  }, [allTabs, enabledFeedIds])

  // Helper function to get display name
  const getDisplayName = (feedId: string, defaultName: string) => {
    const config = loadFeedConfig(feedId)
    return config?.customName || defaultName
  }

  // Move tab left or right
  const moveTabLeft = () => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab)
    if (currentIndex > 0) {
      reorderFeeds(currentIndex, currentIndex - 1)
    }
  }

  const moveTabRight = () => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab)
    if (currentIndex < tabs.length - 1) {
      reorderFeeds(currentIndex, currentIndex + 1)
    }
  }

  const createFeed = () => {
    const uniqueId = `feed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newFeedConfig = {
      name: "New feed",
      id: uniqueId,
      showRepliedTo: true,
      hideReplies: false,
      followDistance: 1,
      showEventsByUnknownUsers: false,
      feedType: "chronological" as const,
      filter: {
        limit: 100,
        kinds: [1],
      },
    }

    // Save the new feed config
    saveFeedConfig(uniqueId, newFeedConfig)

    // Add to enabled feeds at the beginning
    const newEnabledFeedIds = [uniqueId, ...enabledFeedIds]
    setEnabledFeedIds(newEnabledFeedIds)

    // Set as active tab
    setActiveTab(uniqueId)
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex flex-row items-center gap-2 overflow-x-auto max-w-[100vw] scrollbar-hide">
        {/* Edit button */}
        <button
          onClick={onEditModeToggle}
          className={`btn btn-sm btn-circle ${editMode ? "btn-primary" : "btn-neutral"}`}
          title={editMode ? "Done editing" : "Edit feeds"}
        >
          <RiEqualizerFill className="w-4 h-4" />
        </button>

        {/* Create button - only visible in edit mode */}
        {editMode && (
          <button
            onClick={createFeed}
            className="btn btn-sm btn-info"
            title="Create new feed"
          >
            <RiAddLine className="w-4 h-4" />
            New
          </button>
        )}

        {tabs.map((t) => (
          <div key={t.id} className="flex flex-col items-center gap-1">
            <button
              className={`btn btn-sm cursor-pointer whitespace-nowrap ${
                activeTab === t.id ? "btn-primary" : "btn-neutral"
              }`}
              onClick={() => setActiveTab(t.id)}
              title="Click to select"
            >
              {getDisplayName(t.id, t.name)}
            </button>
          </div>
        ))}
      </div>

      {/* Arrow buttons for reordering in edit mode */}
      {editMode && (
        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={moveTabLeft}
            disabled={tabs.findIndex((t) => t.id === activeTab) === 0}
            className="btn btn-sm btn-neutral"
            title="Move active tab left"
          >
            <RiArrowLeftSLine className="w-4 h-4" />
          </button>
          <span className="text-sm text-base-content/70 self-center">
            Move &quot;
            {getDisplayName(activeTab, tabs.find((t) => t.id === activeTab)?.name || "")}
            &quot;
          </span>
          <button
            onClick={moveTabRight}
            disabled={tabs.findIndex((t) => t.id === activeTab) === tabs.length - 1}
            className="btn btn-sm btn-neutral"
            title="Move active tab right"
          >
            <RiArrowRightSLine className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default FeedTabs
export type {FeedTab}
