import {useMemo, useEffect, useState} from "react"

import PublicKeyQRCodeButton from "@/shared/components/user/PublicKeyQRCodeButton"
import NotificationPrompt from "@/shared/components/NotificationPrompt"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import PopularHomeFeed from "@/shared/components/feed/PopularHomeFeed"
import {useRefreshRouteSignal} from "@/stores/notifications"
import {feedCache} from "@/utils/memcache"
import Header from "@/shared/components/header/Header"
import Feed from "@/shared/components/feed/Feed.tsx"
import useFollows from "@/shared/hooks/useFollows"
import {useSocialGraphLoaded} from "@/utils/socialGraph"
import {usePublicKey} from "@/stores/user"
import {
  useFeedStore,
  useEnabledFeedIds,
  useFeedConfigs,
  type FeedConfig,
} from "@/stores/feed"
import FeedTabs, {type Feed as FeedType} from "@/shared/components/feed/FeedTabs"
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

// Convert store config to Feed format - now much simpler since Feed component handles filter logic
const createFeedFromConfig = (config: FeedConfig): FeedType => {
  return {
    name: config.name,
    id: config.id,
    showRepliedTo: config.showRepliedTo,
    sortLikedPosts: config.sortLikedPosts,
    filter: config.filter,
  }
}

function HomeFeedEvents() {
  const myPubKey = usePublicKey()
  const follows = useFollows(myPubKey, true) // to update on follows change
  const refreshSignal = useRefreshRouteSignal()
  const {
    activeFeed,
    setActiveFeed,
    getAllFeedConfigs,
    loadFeedConfig,
    deleteFeed,
    resetAllFeedsToDefaults,
  } = useFeedStore()
  const enabledFeedIds = useEnabledFeedIds()
  const feedConfigs = useFeedConfigs()
  const socialGraphLoaded = useSocialGraphLoaded()
  const [editMode, setEditMode] = useState(false)

  // Convert store configs to Feed format
  const allFeeds: FeedType[] = useMemo(() => {
    const configs = getAllFeedConfigs()
    return configs.map((config) => createFeedFromConfig(config))
  }, [getAllFeedConfigs, feedConfigs, activeFeed])

  // Filter and order feeds based on enabled feed IDs from store
  const feeds = useMemo(() => {
    const feedsMap = new Map(allFeeds.map((feed) => [feed.id, feed]))
    return enabledFeedIds
      .map((id) => feedsMap.get(id))
      .filter((feed): feed is FeedType => feed !== undefined)
  }, [allFeeds, enabledFeedIds])

  const activeFeedItem = useMemo(
    () => feeds.find((f) => f.id === activeFeed) || feeds[0] || null,
    [activeFeed, feeds]
  )

  const activeFeedConfig = useMemo(
    () => loadFeedConfig(activeFeed),
    [loadFeedConfig, activeFeed]
  )

  const openedAt = useMemo(() => Date.now(), [])

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
        `Delete feed "${getDisplayName(feedId, feeds.find((f) => f.id === feedId)?.name || "")}"?`
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

  useEffect(() => {
    if (activeFeed !== "unseen") {
      feedCache.delete("unseen")
    }
    if (activeFeed === "unseen" && refreshSignal > openedAt) {
      feedCache.delete("unseen")
    }
  }, [activeFeedItem, openedAt, refreshSignal, activeFeed])

  // Create a comprehensive key that changes when any relevant config changes
  const feedKey = useMemo(() => {
    return `feed-${JSON.stringify(activeFeedConfig)}`
  }, [activeFeed, activeFeedConfig])

  if (!activeFeedConfig?.filter) {
    return null
  }

  const feedName =
    follows.length <= 1
      ? "Home"
      : activeFeedConfig?.customName || activeFeedItem?.name || "Following"

  return (
    <>
      <Header showBack={false}>
        <span className="md:px-3 md:py-2">{feedName}</span>
      </Header>
      {follows.length > 1 && myPubKey && (
        <FeedTabs
          allTabs={allFeeds}
          editMode={editMode}
          onEditModeToggle={toggleEditMode}
        />
      )}
      {editMode && follows.length > 1 && myPubKey && (
        <FeedEditor
          activeTab={activeFeed}
          tabs={feeds}
          onEditModeToggle={toggleEditMode}
          onDeleteFeed={handleDeleteFeed}
          onResetFeeds={handleResetFeeds}
        />
      )}
      <NotificationPrompt />
      {activeFeedConfig?.feedType === "popular" ? (
        socialGraphLoaded && <PopularHomeFeed />
      ) : (
        <Feed
          key={feedKey}
          feedConfig={activeFeedConfig}
          showDisplayAsSelector={follows.length > 1}
          forceUpdate={0}
          emptyPlaceholder={""}
          refreshSignal={refreshSignal}
          openedAt={openedAt}
        />
      )}
      {socialGraphLoaded && follows.length <= 1 && (
        <>
          <NoFollows myPubKey={myPubKey} />
          <PopularFeed small={false} days={7} />
        </>
      )}
    </>
  )
}

export default HomeFeedEvents
