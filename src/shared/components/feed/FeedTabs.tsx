import React, {useEffect, useRef, useState} from "react"
import {useFeedStore, useEnabledFeedIds, type FeedConfig} from "@/stores/feed"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiEqualizerFill,
  RiAddLine,
} from "@remixicon/react"
import {KIND_TEXT_NOTE} from "@/utils/constants"

interface FeedTabsProps {
  allTabs: FeedConfig[]
  editMode: boolean
  onEditModeToggle: () => void
}

function FeedTabs({allTabs, editMode, onEditModeToggle}: FeedTabsProps) {
  const {
    activeFeed,
    setActiveFeed,
    reorderFeeds,
    saveFeedConfig,
    loadFeedConfig,
    setEnabledFeedIds,
  } = useFeedStore()
  const enabledFeedIds = useEnabledFeedIds()
  const containerRef = useRef<HTMLDivElement>(null)
  const [maxWidth, setMaxWidth] = useState<number | null>(null)

  // Filter and order feeds based on enabled feed IDs from store
  const feeds = React.useMemo(() => {
    const feedsMap = new Map(allTabs.map((feed) => [feed.id, feed]))
    return enabledFeedIds
      .map((id) => feedsMap.get(id))
      .filter((feed): feed is FeedConfig => feed !== undefined)
  }, [allTabs, enabledFeedIds])

  // Helper function to get display name
  const getDisplayName = (feedId: string, defaultName: string) => {
    const config = loadFeedConfig(feedId)
    return config?.customName || defaultName
  }

  // Move feed left or right
  const moveFeedLeft = () => {
    const currentIndex = feeds.findIndex((f) => f.id === activeFeed)
    if (currentIndex > 0) {
      reorderFeeds(currentIndex, currentIndex - 1)
    }
  }

  const moveFeedRight = () => {
    const currentIndex = feeds.findIndex((f) => f.id === activeFeed)
    if (currentIndex < feeds.length - 1) {
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
      feedType: "chronological" as const,
      filter: {
        limit: 100,
        kinds: [KIND_TEXT_NOTE],
      },
    }

    // Save the new feed config
    saveFeedConfig(uniqueId, newFeedConfig)

    // Add to enabled feeds at the beginning
    const newEnabledFeedIds = [uniqueId, ...enabledFeedIds]
    setEnabledFeedIds(newEnabledFeedIds)

    // Set as active feed
    setActiveFeed(uniqueId)
  }

  // Calculate max width for tab container based on available space
  // TODO: fix layout to prevent middle column overflowing x-axis. difficult with sticky elements
  useEffect(() => {
    const calculateMaxWidth = () => {
      if (containerRef.current) {
        const parentWidth = containerRef.current.parentElement?.clientWidth || 0
        // Reserve space for edit button (40px) + create button if in edit mode (80px) + padding (32px)
        const reservedSpace = editMode ? 152 : 72
        setMaxWidth(Math.max(200, parentWidth - reservedSpace))
      }
    }

    calculateMaxWidth()
    window.addEventListener("resize", calculateMaxWidth)
    return () => window.removeEventListener("resize", calculateMaxWidth)
  }, [editMode])

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

        <div
          ref={containerRef}
          className="flex flex-row gap-2 overflow-x-auto scrollbar-hide"
          style={{maxWidth: maxWidth ? `${maxWidth}px` : undefined}}
        >
          {feeds.map((f) => (
            <div key={f.id} className="flex flex-col items-center gap-1 flex-shrink-0">
              <button
                className={`btn btn-sm cursor-pointer whitespace-nowrap ${
                  activeFeed === f.id ? "btn-primary" : "btn-neutral"
                }`}
                onClick={() => setActiveFeed(f.id)}
                title="Click to select"
              >
                {getDisplayName(f.id, f.name)}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Arrow buttons for reordering in edit mode */}
      {editMode && (
        <div className="flex justify-center gap-2 mt-2">
          <button
            onClick={moveFeedLeft}
            disabled={feeds.findIndex((f) => f.id === activeFeed) === 0}
            className="btn btn-sm btn-neutral"
            title="Move active feed left"
          >
            <RiArrowLeftSLine className="w-4 h-4" />
          </button>
          <span className="text-sm text-base-content/70 self-center">
            Move &quot;
            {getDisplayName(
              activeFeed,
              feeds.find((f) => f.id === activeFeed)?.name || ""
            )}
            &quot;
          </span>
          <button
            onClick={moveFeedRight}
            disabled={feeds.findIndex((f) => f.id === activeFeed) === feeds.length - 1}
            className="btn btn-sm btn-neutral"
            title="Move active feed right"
          >
            <RiArrowRightSLine className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default FeedTabs
