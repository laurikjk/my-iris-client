import {useParams, useNavigate} from "@/navigation"
import {useRef, useState, useEffect, FormEvent} from "react"
import Feed from "@/shared/components/feed/Feed"
import {KIND_CLASSIFIED} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"
import {useSettingsStore} from "@/stores/settings"
import {useUIStore} from "@/stores/ui"
import {marketStore} from "@/stores/marketstore"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import {Helmet} from "react-helmet"
import {useIsTwoColumnLayout} from "@/shared/hooks/useIsTwoColumnLayout"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"

export default function MarketPage() {
  const {category} = useParams()
  const navigate = useNavigate()
  const isInTwoColumnLayout = useIsTwoColumnLayout()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const showEventsByUnknownUsers = useSettingsStore(
    (state) => !state.content.hideEventsByUnknownUsers
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [submittedSearch, setSubmittedSearch] = useState("")
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [showMap, setShowMap] = useState(false)
  const [mapEvents, setMapEvents] = useState<NDKEvent[]>([])
  const displayAs = useUIStore((state) => state.marketDisplayAs)
  const setMarketDisplayAs = useUIStore((state) => state.setMarketDisplayAs)

  // Get geohash from URL query params
  const urlParams = new URLSearchParams(window.location.search)
  const geohashFromUrl = urlParams.get("g")
  const [selectedGeohash, setSelectedGeohash] = useState<string | undefined>(
    geohashFromUrl || undefined
  )

  const hasSearchTerm = Boolean(submittedSearch?.trim())
  const hasCategory = Boolean(category?.trim())

  // Update selectedGeohash when URL changes
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search)
      const g = params.get("g")
      setSelectedGeohash(g || undefined)
    }

    // Initial load
    handleLocationChange()

    // Listen for popstate events (browser back/forward)
    window.addEventListener("popstate", handleLocationChange)

    return () => {
      window.removeEventListener("popstate", handleLocationChange)
    }
  }, [])

  useEffect(() => {
    const loadTags = async () => {
      const tags = await marketStore.getTags()
      setAvailableTags(tags)
    }
    loadTags()
  }, [])

  // Subscribe to market events with geohash tags for the map
  useEffect(() => {
    if (!showMap && !category) return

    const filter: NDKFilter = {
      kinds: [KIND_CLASSIFIED],
      limit: 100,
    }

    // Only add category filter if one is selected
    if (category) {
      const tagVariations = [category]
      const lowerTag = category.toLowerCase()
      if (lowerTag !== category) {
        tagVariations.push(lowerTag)
      }
      filter["#t"] = tagVariations
    }

    const sub = ndk().subscribe(filter)
    const events: NDKEvent[] = []

    sub.on("event", (event: NDKEvent) => {
      // Only include events with geohash tags
      if (event.tags.some((tag) => tag[0] === "g")) {
        events.push(event)
        setMapEvents([...events])
      }
    })

    return () => {
      sub.stop()
    }
  }, [showMap, category])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      setSubmittedSearch(searchTerm)
    }
  }

  // Shared feed component
  const FeedComponent = () => {
    if (hasSearchTerm) {
      return (
        <Feed
          key={`market-${submittedSearch}`}
          feedConfig={{
            name: "Market Search Results",
            id: `search-market-${submittedSearch}`,
            showRepliedTo: false,
            showEventsByUnknownUsers: showEventsByUnknownUsers,
            filter: {
              kinds: [KIND_CLASSIFIED],
              search: submittedSearch,
            },
          }}
          displayAs={displayAs}
          onDisplayAsChange={setMarketDisplayAs}
          showDisplayAsSelector={true}
        />
      )
    }
    if (hasCategory || selectedGeohash) {
      const filter: NDKFilter = {
        kinds: [KIND_CLASSIFIED],
      }

      if (hasCategory) {
        const tagVariations = [category]
        const lowerTag = category.toLowerCase()
        if (lowerTag !== category) {
          tagVariations.push(lowerTag)
        }
        filter["#t"] = tagVariations
      }

      if (selectedGeohash) {
        filter["#g"] = [selectedGeohash]
      }

      return (
        <Feed
          key={`market-${category || ""}-${selectedGeohash || ""}`}
          feedConfig={{
            name: `Market${category ? `: ${category}` : ""}${selectedGeohash ? " (filtered by location)" : ""}`,
            id: `search-market-${category || ""}-${selectedGeohash || ""}`,
            showRepliedTo: false,
            showEventsByUnknownUsers: showEventsByUnknownUsers,
            filter,
          }}
          displayAs={displayAs}
          onDisplayAsChange={setMarketDisplayAs}
          showDisplayAsSelector={true}
        />
      )
    }
    return (
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
        displayAs={displayAs}
        onDisplayAsChange={setMarketDisplayAs}
        showDisplayAsSelector={true}
      />
    )
  }

  // Shared controls component
  const Controls = () => (
    <>
      {/* Category label with X button when category is selected */}
      {hasCategory && (
        <div className="mb-3 flex items-center gap-2">
          <span className="badge badge-primary">
            {category}
            <button
              onClick={() => navigate("/m")}
              className="ml-2 hover:text-primary-content/80"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Toggle buttons for Categories and Map */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowMap(false)}
          className={`btn btn-sm ${!showMap ? "btn-primary" : "btn-outline"}`}
        >
          Categories
        </button>
        <button
          onClick={() => setShowMap(true)}
          className={`btn btn-sm ${showMap ? "btn-primary" : "btn-outline"}`}
        >
          Map
        </button>
      </div>

      {/* Show categories or map based on toggle */}
      {!showMap && !hasCategory && (
        <div className="h-32 overflow-y-auto flex flex-wrap gap-2 content-start">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                navigate(`/m/${encodeURIComponent(tag)}`)
              }}
              className={`badge cursor-pointer transition-colors h-fit ${
                category === tag
                  ? "badge-primary"
                  : "badge-outline hover:bg-primary hover:text-primary-content hover:border-primary"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {(showMap || hasCategory) && (
        <GeohashMap
          feedEvents={mapEvents}
          onGeohashSelect={(geohash) => {
            // Don't set wildcard geohashes, just unset
            if (!geohash || geohash === "*") {
              setSelectedGeohash(undefined)
              const params = new URLSearchParams(window.location.search)
              params.delete("g")
              const newUrl = params.toString()
                ? `${window.location.pathname}?${params}`
                : window.location.pathname
              window.history.pushState({}, "", newUrl)
            } else {
              setSelectedGeohash(geohash)
              const params = new URLSearchParams(window.location.search)
              params.set("g", geohash)
              const newUrl = `${window.location.pathname}?${params}`
              window.history.pushState({}, "", newUrl)
            }
          }}
          height="20rem"
        />
      )}
    </>
  )

  // If in two-column layout, only show the feed (controls are in MarketFilters in middle column)
  if (isInTwoColumnLayout) {
    return (
      <div className="flex flex-1 flex-row relative h-full">
        <div className="flex flex-col flex-1 h-full relative">
          <Header title={category ? `Market: ${category}` : "Market"} />
          <ScrollablePageContainer className="flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
              <FeedComponent />
            </div>
            <Helmet>
              <title>{category ? `Market: ${category}` : "Market"} / Iris</title>
            </Helmet>
          </ScrollablePageContainer>
        </div>
      </div>
    )
  }

  // Single column layout - show full interface
  return (
    <div className="flex flex-1 flex-row relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title={category ? `Market: ${category}` : "Market"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
            <SearchTabSelector activeTab="market" />

            <div className="w-full p-2">
              <form onSubmit={handleSubmit} className="w-full">
                <label className="input input-bordered flex items-center gap-2 w-full">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="grow"
                    placeholder="Search market..."
                    value={hasSearchTerm ? submittedSearch : searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      if (hasSearchTerm) {
                        setSubmittedSearch("")
                      }
                    }}
                  />
                  <Icon name="search-outline" className="text-neutral-content/60" />
                </label>
              </form>
            </div>

            <div className="px-4 mb-6">
              <Controls />
            </div>

            <div className="mt-4">
              <FeedComponent />
            </div>
          </div>
          <Helmet>
            <title>{category ? `Market: ${category}` : "Market"} / Iris</title>
          </Helmet>
        </ScrollablePageContainer>
      </div>
    </div>
  )
}
