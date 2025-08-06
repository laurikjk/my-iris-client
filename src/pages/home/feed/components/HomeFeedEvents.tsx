import {useMemo, useState, useEffect, useRef} from "react"
import {RiArrowLeftSLine, RiArrowRightSLine} from "@remixicon/react"

import PublicKeyQRCodeButton from "@/shared/components/user/PublicKeyQRCodeButton"
import NotificationPrompt from "@/shared/components/NotificationPrompt"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {feedCache} from "@/utils/memcache"
import Header from "@/shared/components/header/Header"
import Feed from "@/shared/components/feed/Feed.tsx"
import useFollows from "@/shared/hooks/useFollows"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import {usePublicKey} from "@/stores/user"
import {useSettingsStore} from "@/stores/settings"
import {useIsLargeScreen} from "@/shared/hooks/useIsLargeScreen"
import {useUIStore} from "@/stores/ui"
import {
  useFeedStore,
  useEnabledFeedIds,
  useFeedConfigs,
  type FeedConfig,
  getFeedCacheKey,
} from "@/stores/feed"
import FeedTabs from "@/shared/components/feed/FeedTabs"
import FeedEditor from "@/shared/components/feed/FeedEditor"

const NoFollows = ({myPubKey}: {myPubKey?: string}) =>
  myPubKey ? (
    <div className="flex flex-col gap-8 items-center justify-center text-base-content/50">
      <div className="px-4 py-8 border-b border-base-300 flex flex-col gap-8 items-center w-full">
        Follow someone to see content from them
        {myPubKey && <PublicKeyQRCodeButton publicKey={myPubKey} />}
      </div>
    </div>
  ) : null

function HomeFeedEvents() {
  const containerRef = useRef<HTMLDivElement>(null)
  const myPubKey = usePublicKey()
  const follows = useFollows(myPubKey, true) // to update on follows change
  const {appearance, updateAppearance} = useSettingsStore()
  const isLargeScreen = useIsLargeScreen()
  const navItemClicked = useUIStore((state) => state.navItemClicked)
  const {
    activeFeed,
    setActiveFeed,
    getAllFeedConfigs,
    loadFeedConfig,
    deleteFeed,
    cloneFeed,
    resetAllFeedsToDefaults,
    feedRefreshSignal,
  } = useFeedStore()
  const enabledFeedIds = useEnabledFeedIds()
  const feedConfigs = useFeedConfigs()
  const socialGraphLoaded = useSocialGraphLoaded()
  const [editMode, setEditMode] = useState(false)

  // Handle home nav click to scroll to top
  useEffect(() => {
    if (navItemClicked.signal === 0 || navItemClicked.path !== "/") return

    // Find the scrollable container
    const scrollContainer = containerRef.current?.closest(".overflow-y-scroll")
    if (scrollContainer) {
      scrollContainer.scrollTo({top: 0, behavior: "instant"})
    }
  }, [navItemClicked])

  // Get all feed configs from store
  const allFeeds = useMemo(() => {
    return getAllFeedConfigs()
  }, [getAllFeedConfigs, feedConfigs, activeFeed])

  // Filter and order feeds based on enabled feed IDs from store
  const feeds = useMemo(() => {
    const feedsMap = new Map(allFeeds.map((feed) => [feed.id, feed]))
    return enabledFeedIds
      .map((id) => feedsMap.get(id))
      .filter((feed): feed is FeedConfig => feed !== undefined)
  }, [allFeeds, enabledFeedIds])

  const activeFeedItem = useMemo(
    () => feeds.find((f) => f.id === activeFeed) || feeds[0] || null,
    [activeFeed, feeds]
  )

  const activeFeedConfig = useMemo(
    () => loadFeedConfig(activeFeed),
    [loadFeedConfig, activeFeed, feedConfigs]
  )

  // Editor handler functions
  const toggleEditMode = () => {
    setEditMode(!editMode)
  }

  const handleDeleteFeed = (feedId: string) => {
    if (feeds.length <= 1) {
      return // Don't allow deleting the last feed
    }

    const getDisplayName = (feedId: string, defaultName: string) => {
      const config = loadFeedConfig(feedId)
      return config?.customName || defaultName
    }

    if (
      confirm(
        `Delete feed "${getDisplayName(feedId, allFeeds.find((f) => f.id === feedId)?.name || "")}"?`
      )
    ) {
      // If deleting the active feed, switch to the first remaining feed
      if (feedId === activeFeed) {
        const remainingFeeds = feeds.filter((f) => f.id !== feedId)
        if (remainingFeeds.length > 0) {
          setActiveFeed(remainingFeeds[0].id)
        }
      }

      deleteFeed(feedId)
    }
  }

  const handleResetFeeds = () => {
    if (confirm("Reset all feeds to defaults?")) {
      console.log("User confirmed reset")
      setEditMode(false)
      feedCache.clear()
      resetAllFeedsToDefaults()
      console.log("Reset function called")
    }
  }

  const handleCloneFeed = (feedId: string) => {
    cloneFeed(feedId)
  }

  // Create a comprehensive key that changes when any relevant config changes
  const feedKey = useMemo(() => {
    if (!activeFeedConfig) return "feed-null"
    return `feed-${getFeedCacheKey(activeFeedConfig)}`
  }, [activeFeedConfig])

  if (!activeFeedConfig?.filter && !activeFeedConfig?.feedStrategy) {
    return null
  }

  const feedName =
    follows.length <= 1
      ? "Home"
      : activeFeedConfig?.customName || activeFeedItem?.name || "Following"

  if (!socialGraphLoaded) {
    return null
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Header showBack={false} inColumn={true}>
        <div className="flex items-center justify-between w-full">
          <span className="md:px-3 md:py-2">{feedName}</span>
          {isLargeScreen && (
            <button
              className="p-2 bg-base-100 hover:bg-base-200 rounded-full transition-colors mt-1"
              onClick={() =>
                updateAppearance({singleColumnLayout: !appearance.singleColumnLayout})
              }
              title={
                appearance.singleColumnLayout
                  ? "Expand to two columns"
                  : "Collapse to single column"
              }
            >
              {appearance.singleColumnLayout ? (
                <RiArrowLeftSLine className="w-5 h-5" />
              ) : (
                <RiArrowRightSLine className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </Header>
      <div>
        {follows.length > 1 && myPubKey && (
          <FeedTabs
            allTabs={allFeeds}
            editMode={editMode}
            onEditModeToggle={toggleEditMode}
          />
        )}
        {editMode && follows.length > 1 && myPubKey && (
          <FeedEditor
            key={activeFeed}
            activeTab={activeFeed}
            tabs={feeds}
            onEditModeToggle={toggleEditMode}
            onDeleteFeed={handleDeleteFeed}
            onResetFeeds={handleResetFeeds}
            onCloneFeed={handleCloneFeed}
          />
        )}
        <NotificationPrompt />
        {(() => {
          if (!myPubKey) return <AlgorithmicFeed type="popular" />

          if (activeFeedConfig?.feedStrategy)
            return <AlgorithmicFeed type={activeFeedConfig.feedStrategy} />

          return (
            <Feed
              key={feedKey}
              feedConfig={activeFeedConfig}
              showDisplayAsSelector={follows.length > 1}
              forceUpdate={0}
              emptyPlaceholder={""}
              refreshSignal={feedRefreshSignal}
            />
          )
        })()}
        {follows.length <= 1 && myPubKey && (
          <>
            <NoFollows myPubKey={myPubKey} />
            {!activeFeedConfig?.feedStrategy && (
              <AlgorithmicFeed
                type="popular"
                displayOptions={{showDisplaySelector: false}}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default HomeFeedEvents
