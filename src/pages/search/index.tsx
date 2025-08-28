import {useMemo, useState, useEffect, FormEvent, useRef} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import useHistoryState from "@/shared/hooks/useHistoryState"
import SearchBox from "@/shared/components/ui/SearchBox"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import {NDKFilter, NDKEvent} from "@nostr-dev-kit/ndk"
import Feed from "@/shared/components/feed/Feed.tsx"
import {useParams, useNavigate} from "@/navigation"
import Widget from "@/shared/components/ui/Widget"
import {Helmet} from "react-helmet"
import {useSettingsStore} from "@/stores/settings"
import {useUIStore} from "@/stores/ui"
import {KIND_CLASSIFIED, KIND_TEXT_NOTE, KIND_EPHEMERAL} from "@/utils/constants"
import socialGraph from "@/utils/socialGraph"
import {UserRow} from "@/shared/components/user/UserRow"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"

function SearchPage() {
  const {query} = useParams()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState(query || "")
  const [activeTab, setActiveTab] = useHistoryState<
    "people" | "posts" | "market" | "map"
  >(query ? "posts" : "people", "searchTab")
  const [forceUpdate, setForceUpdate] = useState(0)
  const navItemClicked = useUIStore((state) => state.navItemClicked)

  const {content} = useSettingsStore()
  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useHistoryState(
    !content.hideEventsByUnknownUsers,
    "searchShowEventsByUnknownUsers"
  )

  useEffect(() => {
    setSearchTerm(query?.toLowerCase() || "")
    if (query) {
      setActiveTab("posts")
    }
  }, [query, setActiveTab])

  useEffect(() => {
    setForceUpdate((prev) => prev + 1)
  }, [activeTab])

  // Focus search input when search nav item is clicked (for posts/market tabs)
  useEffect(() => {
    if (navItemClicked.path !== "/search") return

    // Focus the input for posts/market tabs
    if (activeTab !== "people") {
      searchInputRef.current?.focus()
    }
  }, [navItemClicked, activeTab])

  const filters: NDKFilter = useMemo(
    () => ({
      kinds: activeTab === "market" ? [KIND_CLASSIFIED] : [KIND_TEXT_NOTE],
      search: query,
    }),
    [query, activeTab]
  )

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm !== query) {
      navigate(`/search/${searchTerm}`)
    }
  }

  return (
    <div className="flex flex-1 flex-row relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title={query ? `Search: "${query}"` : "Search"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full max-w-screen-lg flex flex-col gap-4 md:pt-2">
            {activeTab === "people" ? (
              <div className="p-2">
                <SearchBox searchNotes={true} maxResults={10} focusOnNav={true} />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex w-full p-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search"
                  className="input input-bordered w-full"
                />
                <button type="submit" className="btn btn-primary ml-2">
                  Search
                </button>
              </form>
            )}
            <div className="flex gap-2 overflow-x-auto p-2">
              <button
                className={`btn btn-sm ${activeTab === "people" ? "btn-primary" : "btn-neutral"}`}
                onClick={() => setActiveTab("people")}
              >
                People
              </button>
              <button
                className={`btn btn-sm ${activeTab === "posts" ? "btn-primary" : "btn-neutral"}`}
                onClick={() => setActiveTab("posts")}
              >
                Posts
              </button>
              <button
                className={`btn btn-sm ${activeTab === "market" ? "btn-primary" : "btn-neutral"}`}
                onClick={() => setActiveTab("market")}
              >
                Market
              </button>
              <button
                className={`btn btn-sm ${activeTab === "map" ? "btn-primary" : "btn-neutral"}`}
                onClick={() => setActiveTab("map")}
              >
                Map
              </button>
            </div>

            {query && activeTab !== "people" && (
              <div className="flex items-center gap-2 p-2 mx-2">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={showEventsByUnknownUsers}
                  onChange={(e) => setShowEventsByUnknownUsers(e.target.checked)}
                />
                <span className="text-sm">Show posts from unknown users</span>
              </div>
            )}

            {query ? (
              <Feed
                key={`${activeTab}-${query}`}
                feedConfig={{
                  name: "Search Results",
                  id: `search-${activeTab}-${query}`,
                  showRepliedTo: false,
                  showEventsByUnknownUsers: showEventsByUnknownUsers,
                  filter: filters,
                }}
                forceUpdate={forceUpdate}
              />
            ) : (
              <NoSearchTermContent activeTab={activeTab} />
            )}
          </div>
          <Helmet>
            <title>{query ? `Search: ${query}` : `Search`} / Iris</title>
          </Helmet>
        </ScrollablePageContainer>
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular" className="h-96">
              <AlgorithmicFeed
                type="popular"
                displayOptions={{
                  small: true,
                  showDisplaySelector: false,
                }}
              />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}

function NoSearchTermContent({
  activeTab,
}: {
  activeTab: "people" | "posts" | "market" | "map"
}) {
  if (activeTab === "people") {
    return (
      <div className="mt-4">
        <FollowedUsersList />
      </div>
    )
  }

  if (activeTab === "posts") {
    return (
      <div className="mt-4">
        <AlgorithmicFeed type="popular" displayOptions={{showDisplaySelector: true}} />
      </div>
    )
  }

  if (activeTab === "market") {
    return (
      <div className="mt-4">
        <Feed
          feedConfig={{
            name: "Market",
            id: "market",
            showRepliedTo: false,
            filter: {
              kinds: [KIND_CLASSIFIED],
              limit: 100,
            },
            followDistance: 3,
            hideReplies: true,
          }}
        />
      </div>
    )
  }

  // Map tab
  return <MapContent />
}

function MapContent() {
  const [feedEvents, setFeedEvents] = useState<NDKEvent[]>([])
  const [selectedGeohashes, setSelectedGeohashes] = useState<string[]>([])

  // Default to all geohashes when none selected
  const allGeohashes = "0123456789bcdefghjkmnpqrstuvwxyz".split("")
  const geohashes = selectedGeohashes.length > 0 ? selectedGeohashes : allGeohashes

  const feedConfig = useMemo(
    () => ({
      id: "map-search",
      name: "Location Feed",
      filter: {
        kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL],
        "#g": geohashes,
        limit: 100,
      },
      followDistance: 5,
      showRepliedTo: true,
      hideReplies: false,
    }),
    [geohashes]
  )

  return (
    <div className="mt-4">
      <GeohashMap
        geohashes={geohashes}
        feedEvents={feedEvents}
        onGeohashSelect={(geohash) => {
          setSelectedGeohashes([geohash.toLowerCase()])
        }}
        height="20rem"
        className="w-full max-w-full"
      />
      <div className="mt-4">
        <Feed
          key={geohashes.join(",")}
          feedConfig={feedConfig}
          showReplies={0}
          borderTopFirst={true}
          showDisplayAsSelector={true}
          onEvent={(event) => {
            setFeedEvents((prev) => {
              if (prev.some((e) => e.id === event.id)) return prev
              return [...prev.slice(-99), event]
            })
          }}
        />
      </div>
    </div>
  )
}

function FollowedUsersList() {
  const [displayCount, setDisplayCount] = useState(20)
  const graph = socialGraph()
  const rootUser = graph.getRoot()
  const follows = graph.getFollowedByUser(rootUser)

  // Sort followed users by how many of your friends follow them
  const sortedFollows = useMemo(() => {
    if (!follows) return []

    return Array.from(follows)
      .map((pubkey) => ({
        pubkey,
        followedByCount: graph.followedByFriends(pubkey).size,
      }))
      .sort((a, b) => b.followedByCount - a.followedByCount)
  }, [follows, graph, rootUser])

  const loadMore = () => {
    if (displayCount < sortedFollows.length) {
      setDisplayCount((prev) => Math.min(prev + 20, sortedFollows.length))
    }
  }

  return (
    <InfiniteScroll onLoadMore={loadMore}>
      <div className="flex flex-col gap-2 p-2">
        {sortedFollows.slice(0, displayCount).map(({pubkey}) => (
          <UserRow key={pubkey} pubKey={pubkey} linkToProfile={true} />
        ))}
      </div>
    </InfiniteScroll>
  )
}

export default SearchPage
