import {useMemo, useState, useEffect, useRef} from "react"
import classNames from "classnames"

import RightColumn from "@/shared/components/RightColumn"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import Feed from "@/shared/components/feed/Feed.tsx"
import {type FeedConfig, useFeedStore} from "@/stores/feed"
import {shouldHideAuthor} from "@/utils/visibility"
import Widget from "@/shared/components/ui/Widget"
import useFollows from "@/shared/hooks/useFollows"
import {PublicKey} from "@/shared/utils/PublicKey"
import FollowList from "./components/FollowList"
import socialGraph from "@/utils/socialGraph"
import ProfileHeader from "./ProfileHeader"
import {useUserStore} from "@/stores/user"
import {ndk} from "@/utils/ndk"
import {
  KIND_TEXT_NOTE,
  KIND_REPOST,
  KIND_REACTION,
  KIND_CLASSIFIED,
} from "@/utils/constants"

type Tab = {
  name: string
  path: string
  getFeedConfig: (pubKey: string, myPubKey: string) => FeedConfig
}

const tabs: Tab[] = [
  {
    name: "Posts",
    path: "",
    getFeedConfig: (pubKey) => ({
      name: "Posts",
      id: `profile-posts`,
      hideReplies: true,
      showEventsByUnknownUsers: true,
      filter: {kinds: [KIND_TEXT_NOTE, KIND_REPOST], authors: [pubKey]},
    }),
  },
  {
    name: "Market",
    path: "market",
    getFeedConfig: (pubKey) => ({
      name: "Market",
      id: `profile-market`,
      showEventsByUnknownUsers: true,
      filter: {kinds: [KIND_CLASSIFIED], authors: [pubKey]},
      showRepliedTo: true,
    }),
  },
  {
    name: "Replies",
    path: "replies",
    getFeedConfig: (pubKey) => ({
      name: "Replies",
      id: `profile-replies`,
      showEventsByUnknownUsers: true,
      filter: {kinds: [KIND_TEXT_NOTE, KIND_REPOST], authors: [pubKey]},
      showRepliedTo: true,
    }),
  },
  {
    name: "Media",
    path: "media",
    getFeedConfig: (pubKey) => ({
      name: "Media",
      id: `profile-media`,
      requiresMedia: true,
      showEventsByUnknownUsers: true,
      filter: {kinds: [KIND_TEXT_NOTE, KIND_REPOST], authors: [pubKey]},
    }),
  },
  {
    name: "Likes",
    path: "likes",
    getFeedConfig: (pubKey) => ({
      name: "Likes",
      id: `profile-likes`,
      showEventsByUnknownUsers: true,
      filter: {kinds: [KIND_REACTION], authors: [pubKey]},
    }),
  },
  {
    name: "You",
    path: "you",
    getFeedConfig: (pubKey, myPubKey) => ({
      name: "You",
      id: `profile-you`,
      showEventsByUnknownUsers: true,
      filter: {
        kinds: [KIND_TEXT_NOTE, KIND_REPOST, KIND_REACTION],
        authors: [pubKey],
        "#p": [myPubKey],
      },
      showRepliedTo: true,
    }),
  },
]

function useHasMarketEvents(pubKey: string) {
  const [hasMarketEvents, setHasMarketEvents] = useState(false)

  useEffect(() => {
    if (!pubKey) return

    // Reset state when pubKey changes
    setHasMarketEvents(false)

    const sub = ndk().subscribe({
      kinds: [KIND_CLASSIFIED],
      authors: [pubKey],
      limit: 1,
    })

    sub.on("event", () => {
      setHasMarketEvents(true)
      sub.stop()
    })

    return () => {
      sub.stop()
    }
  }, [pubKey])

  return hasMarketEvents
}

function UserPage({pubKey}: {pubKey: string}) {
  if (typeof pubKey !== "string") {
    throw new Error(
      "pubKey must be a string, received: " + typeof pubKey + " " + JSON.stringify(pubKey)
    )
  }
  const pubKeyHex = useMemo(
    () => (pubKey ? new PublicKey(pubKey).toString() : ""),
    [pubKey]
  )
  const myPubKey = useUserStore((state) => state.publicKey)
  const {loadFeedConfig} = useFeedStore()
  const follows = useFollows(pubKey)
  const hasMarketEvents = useHasMarketEvents(pubKeyHex)
  const [activeTab, setActiveTab] = useState("")
  const [feedMinHeight, setFeedMinHeight] = useState<number>(0)
  const feedContainerRef = useRef<HTMLDivElement>(null)
  const filteredFollows = useMemo(() => {
    const filtered = myPubKey
      ? follows.filter((follow) => socialGraph().getFollowDistance(follow) > 1)
      : follows
    return filtered.sort(() => Math.random() - 0.5) // Randomize order
  }, [follows])

  const visibleTabs = tabs.filter(
    (tab) =>
      (tab.path !== "you" || (myPubKey && !shouldHideAuthor(pubKeyHex))) &&
      (tab.path !== "market" || hasMarketEvents || activeTab === "market")
  )

  return (
    <div className="flex flex-1 justify-center">
      <div className="flex flex-1 justify-center">
        <div className="flex flex-1 flex-col items-center justify-center h-full">
          <ProfileHeader pubKey={pubKey} key={pubKey} />
          <div className="flex w-full flex-1 mt-2 flex flex-col gap-4">
            <div className="px-4 flex gap-2 overflow-x-auto max-w-[100vw] scrollbar-hide">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.path}
                  onClick={(e) => {
                    e.preventDefault()
                    // Capture current feed height before switching
                    if (feedContainerRef.current) {
                      const currentHeight = feedContainerRef.current.offsetHeight
                      // Set min-height to at least maintain viewport visibility
                      const viewportHeight = window.innerHeight
                      const scrollY = window.scrollY
                      const feedTop =
                        feedContainerRef.current.getBoundingClientRect().top + scrollY
                      const visibleHeight = Math.min(
                        currentHeight,
                        viewportHeight - (feedTop - scrollY)
                      )
                      setFeedMinHeight(Math.max(visibleHeight, 400)) // At least 400px
                    }
                    setActiveTab(tab.path)
                    // Clear min-height after render
                    setTimeout(() => setFeedMinHeight(0), 100)
                  }}
                  className={classNames(
                    "btn btn-sm",
                    activeTab === tab.path ? "btn-primary" : "btn-neutral"
                  )}
                >
                  {tab.name}
                </button>
              ))}
            </div>
            {(() => {
              const activeTabConfig =
                visibleTabs.find((tab) => tab.path === activeTab) || visibleTabs[0]

              const baseFeedConfig = activeTabConfig.getFeedConfig(pubKeyHex, myPubKey)
              const savedConfig = loadFeedConfig(baseFeedConfig.id)
              const feedConfig = {
                ...baseFeedConfig,
                displayAs: savedConfig?.displayAs,
              }

              return (
                <div
                  ref={feedContainerRef}
                  style={{minHeight: feedMinHeight ? `${feedMinHeight}px` : undefined}}
                >
                  <Feed
                    key={`feed-${pubKeyHex}-${activeTabConfig.path}`}
                    feedConfig={feedConfig}
                    borderTopFirst={true}
                  />
                </div>
              )
            })()}
          </div>
        </div>
      </div>
      <RightColumn>
        {() => (
          <>
            {filteredFollows.length > 0 && (
              <Widget title="Follows">
                <FollowList follows={filteredFollows} />
              </Widget>
            )}
            {pubKeyHex === myPubKey && (
              <Widget title="Popular">
                <PopularFeed
                  displayOptions={{
                    small: true,
                    showDisplaySelector: false,
                    randomSort: true,
                  }}
                />
              </Widget>
            )}
          </>
        )}
      </RightColumn>
    </div>
  )
}

export default UserPage
