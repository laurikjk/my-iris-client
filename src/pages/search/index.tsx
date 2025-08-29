import {useMemo, useState, useEffect, FormEvent, useRef, RefObject} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import useHistoryState from "@/shared/hooks/useHistoryState"
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
import {useSearch} from "@/shared/hooks/useSearch"
import {nip19} from "nostr-tools"
import Icon from "@/shared/components/Icons/Icon"
import {ALL_GEOHASHES} from "@/utils/geohash"

interface UnifiedSearchInputProps {
  activeTab: "people" | "posts" | "market" | "map"
  searchTerm: string
  setSearchTerm: (term: string) => void
  marketSearchTerm: string
  setMarketSearchTerm: (term: string) => void
  mapSearchTerm: string
  setMapSearchTerm: (term: string) => void
  peopleSearch: ReturnType<typeof useSearch>
  navigate: (path: string) => void
  searchInputRef: RefObject<HTMLInputElement | null>
  setSelectedGeohashes: (geohashes: string[]) => void
}

function UnifiedSearchInput({
  activeTab,
  searchTerm,
  setSearchTerm,
  marketSearchTerm,
  setMarketSearchTerm,
  mapSearchTerm,
  setMapSearchTerm,
  peopleSearch,
  navigate,
  searchInputRef,
  setSelectedGeohashes,
}: UnifiedSearchInputProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (activeTab === "posts") {
      navigate(`/search/${searchTerm}`)
    }
    // Market and map search are handled via state/instant updates, no navigation needed
  }

  const getCurrentValue = () => {
    switch (activeTab) {
      case "people":
        return peopleSearch.value
      case "posts":
        return searchTerm
      case "market":
        return marketSearchTerm
      case "map":
        return mapSearchTerm
      default:
        return ""
    }
  }

  const handleInputChange = (value: string) => {
    switch (activeTab) {
      case "people":
        peopleSearch.setValue(value)
        break
      case "posts":
        setSearchTerm(value)
        break
      case "market":
        setMarketSearchTerm(value)
        break
      case "map":
        setMapSearchTerm(value)
        // Update map instantly as user types
        if (value.trim()) {
          const geohash = value.toLowerCase().replace(/[^0-9bcdefghjkmnpqrstuvwxyz]/g, "")
          if (geohash) {
            setSelectedGeohashes((current) => {
              // Only update if different to prevent unnecessary re-renders
              if (current.length === 1 && current[0] === geohash) return current
              return [geohash]
            })
          }
        } else {
          setSelectedGeohashes([])
        }
        break
    }
  }

  const getPlaceholder = () => {
    switch (activeTab) {
      case "people":
        return "Search people..."
      case "posts":
        return "Search posts..."
      case "market":
        return "Search market..."
      case "map":
        return "Search geohash area..."
      default:
        return "Search..."
    }
  }

  // No dropdown for any tab - results show in content area

  return (
    <div className="w-full p-2">
      <form onSubmit={handleSubmit} className="w-full">
        <label className="input input-bordered flex items-center gap-2 w-full">
          <input
            ref={searchInputRef}
            type="text"
            className="grow"
            placeholder={getPlaceholder()}
            value={getCurrentValue()}
            onChange={(e) => handleInputChange(e.target.value)}
          />
          <Icon name="search-outline" className="text-neutral-content/60" />
        </label>
      </form>
    </div>
  )
}

function SearchPage() {
  const {query} = useParams()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState(query || "")
  const [activeTab, setActiveTab] = useHistoryState<
    "people" | "posts" | "market" | "map"
  >(query ? "posts" : "people", "searchTab")
  const [forceUpdate, setForceUpdate] = useState(0)
  const [marketSearchTerm, setMarketSearchTerm] = useState("")
  const [mapSearchTerm, setMapSearchTerm] = useState("")
  const [selectedGeohashes, setSelectedGeohashes] = useState<string[]>([])
  const navItemClicked = useUIStore((state) => state.navItemClicked)

  // People search using extracted SearchBox logic
  const peopleSearch = useSearch({
    maxResults: 10,
    onSelect: (pubKey: string) => {
      try {
        navigate(`/${nip19.npubEncode(pubKey)}`)
      } catch (error) {
        console.error("Error encoding pubkey:", error)
        navigate(`/${pubKey}`)
      }
    },
  })

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
    // Clear search inputs when changing tabs
    peopleSearch.setValue("")
    setSearchTerm("")
    setMarketSearchTerm("")
    setMapSearchTerm("")
  }, [activeTab])

  // Focus search input when search nav item is clicked (for posts/market tabs)
  useEffect(() => {
    if (navItemClicked.path !== "/search") return

    // Focus the input for posts/market tabs
    if (activeTab !== "people") {
      searchInputRef.current?.focus()
    }
  }, [navItemClicked, activeTab])

  const filters: NDKFilter = useMemo(() => {
    if (activeTab === "market") {
      return {
        kinds: [KIND_CLASSIFIED],
        search: marketSearchTerm || query,
      }
    }
    return {
      kinds: [KIND_TEXT_NOTE],
      search: query,
    }
  }, [query, activeTab, marketSearchTerm])

  return (
    <div className="flex flex-1 flex-row relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title={query ? `Search: "${query}"` : "Search"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full max-w-screen-lg flex flex-col gap-2 md:pt-2">
            <UnifiedSearchInput
              activeTab={activeTab}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              marketSearchTerm={marketSearchTerm}
              setMarketSearchTerm={setMarketSearchTerm}
              mapSearchTerm={mapSearchTerm}
              setMapSearchTerm={setMapSearchTerm}
              peopleSearch={peopleSearch}
              navigate={navigate}
              searchInputRef={searchInputRef}
              setSelectedGeohashes={setSelectedGeohashes}
            />
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
              <NoSearchTermContent
                activeTab={activeTab}
                selectedGeohashes={selectedGeohashes}
                setSelectedGeohashes={setSelectedGeohashes}
                peopleSearch={peopleSearch}
                setMapSearchTerm={setMapSearchTerm}
              />
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
  selectedGeohashes,
  setSelectedGeohashes,
  peopleSearch,
  setMapSearchTerm,
}: {
  activeTab: "people" | "posts" | "market" | "map"
  selectedGeohashes: string[]
  setSelectedGeohashes: (geohashes: string[]) => void
  peopleSearch: ReturnType<typeof useSearch>
  setMapSearchTerm: (term: string) => void
}) {
  if (activeTab === "people") {
    return (
      <div className="mt-4">
        <FollowedUsersList peopleSearch={peopleSearch} />
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
  return (
    <MapContent
      selectedGeohashes={selectedGeohashes}
      setSelectedGeohashes={setSelectedGeohashes}
      setMapSearchTerm={setMapSearchTerm}
    />
  )
}

function MapContent({
  selectedGeohashes,
  setSelectedGeohashes,
  setMapSearchTerm,
}: {
  selectedGeohashes: string[]
  setSelectedGeohashes: (geohashes: string[]) => void
  setMapSearchTerm: (term: string) => void
}) {
  const [feedEvents, setFeedEvents] = useState<NDKEvent[]>([])

  // Use selected geohashes or empty array for initial state
  const geohashes = selectedGeohashes

  const feedConfig = useMemo(() => {
    // When no geohashes selected, show global view with all geohashes
    const isGlobalView = geohashes.length === 0

    const filter = isGlobalView
      ? {
          kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL],
          "#g": ALL_GEOHASHES,
          limit: 100,
        }
      : {
          kinds: [KIND_TEXT_NOTE, KIND_EPHEMERAL],
          "#g": geohashes,
          limit: 100,
        }

    return {
      id: "map-search",
      name: "Location Feed",
      filter,
      followDistance: 5,
      showRepliedTo: true,
      hideReplies: false,
    }
  }, [geohashes])

  return (
    <div className="mt-4">
      <GeohashMap
        geohashes={geohashes.length === 0 ? ALL_GEOHASHES : geohashes}
        feedEvents={feedEvents}
        onGeohashSelect={(geohash) => {
          setSelectedGeohashes([geohash.toLowerCase()])
          setMapSearchTerm(geohash.toLowerCase()) // Update search input to match selection
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

function FollowedUsersList({peopleSearch}: {peopleSearch: ReturnType<typeof useSearch>}) {
  const [displayCount, setDisplayCount] = useState(20)
  const graph = socialGraph()
  const rootUser = graph.getRoot()
  const follows = graph.getFollowedByUser(rootUser)

  // Show search results if there's a search term, otherwise show followed users
  const displayUsers = useMemo(() => {
    if (peopleSearch.value.trim()) {
      // Show search results
      return peopleSearch.searchResults.map((result) => ({
        pubkey: result.pubKey,
        followedByCount: graph.followedByFriends(result.pubKey).size,
      }))
    }

    // Show followed users sorted by how many of your friends follow them
    if (!follows) return []

    return Array.from(follows)
      .map((pubkey) => ({
        pubkey,
        followedByCount: graph.followedByFriends(pubkey).size,
      }))
      .sort((a, b) => b.followedByCount - a.followedByCount)
  }, [follows, graph, rootUser, peopleSearch.value, peopleSearch.searchResults])

  const loadMore = () => {
    if (displayCount < displayUsers.length) {
      setDisplayCount((prev) => Math.min(prev + 20, displayUsers.length))
    }
  }

  return (
    <InfiniteScroll onLoadMore={loadMore}>
      <div className="flex flex-col gap-2 px-4">
        {displayUsers.slice(0, displayCount).map(({pubkey}) => (
          <UserRow key={pubkey} pubKey={pubkey} linkToProfile={true} />
        ))}
      </div>
    </InfiniteScroll>
  )
}

export default SearchPage
