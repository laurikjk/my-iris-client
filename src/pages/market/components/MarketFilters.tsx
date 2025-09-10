import {useParams, useNavigate} from "@/navigation"
import {useRef, useState, useEffect, FormEvent, useMemo} from "react"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Icon from "@/shared/components/Icons/Icon"
import {marketStore} from "@/stores/marketstore"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {KIND_CLASSIFIED} from "@/utils/constants"
import Feed from "@/shared/components/feed/Feed"
import {useSettingsStore} from "@/stores/settings"
import {RiMapPinLine} from "@remixicon/react"
import {CategoryLabel} from "@/shared/components/market/CategoryLabel"

interface MarketFiltersProps {
  mapHeight?: string
  categoriesHeight?: string
  includeSearch?: boolean
}

export default function MarketFilters({
  mapHeight = "calc(100vh - 242px)",
  categoriesHeight = "",
  includeSearch = true,
}: MarketFiltersProps = {}) {
  const {category} = useParams()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Get search query from URL
  const urlParams = new URLSearchParams(window.location.search)
  const searchFromUrl = urlParams.get("q")
  const [searchTerm, setSearchTerm] = useState(searchFromUrl || "")
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [mapEvents, setMapEvents] = useState<NDKEvent[]>([])
  const showEventsByUnknownUsers = useSettingsStore(
    (state) => !state.content.hideEventsByUnknownUsers
  )

  // Get geohash from URL query params or localStorage fallback
  const geohashFromUrl = urlParams.get("g")
  const storedGeohash = category
    ? localStorage.getItem(`market-geohash-${category}`)
    : null
  const [selectedGeohash, setSelectedGeohash] = useState<string | undefined>(
    geohashFromUrl || storedGeohash || undefined
  )

  const hasCategory = Boolean(category?.trim())

  // Show map by default when category is selected
  const [showMap, setShowMap] = useState(hasCategory)

  // Update showMap when category changes
  useEffect(() => {
    setShowMap(Boolean(category?.trim()))
  }, [category])

  // Listen for URL changes to update selected geohash and search
  // Also restore query params if they're missing
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search)
      const g = params.get("g")
      const q = params.get("q")
      setSelectedGeohash(g || undefined)
      setSearchTerm(q || "")
    }

    // Check if we have a stored geohash but it's not in the URL
    if (selectedGeohash && !window.location.search.includes("g=")) {
      const params = new URLSearchParams(window.location.search)
      params.set("g", selectedGeohash)
      const newUrl = `${window.location.pathname}?${params}`
      window.history.replaceState({}, "", newUrl)
    }

    window.addEventListener("popstate", handleLocationChange)

    return () => {
      window.removeEventListener("popstate", handleLocationChange)
    }
  }, [selectedGeohash])

  useEffect(() => {
    const loadTags = async () => {
      const tags = await marketStore.getTags()
      setAvailableTags(tags)
    }
    loadTags()
  }, [])

  // Create feed config for collecting market events
  // Don't filter by category for map collection - show all events on map
  const feedConfig = useMemo(() => {
    const filter: NDKFilter = {
      kinds: [KIND_CLASSIFIED],
      limit: 500,
    }

    return {
      id: `market-map-all`,
      name: "Market Map Events",
      filter,
      followDistance: 3,
      showRepliedTo: false,
      hideReplies: true,
      showEventsByUnknownUsers: true, // Show all events on map
    }
  }, [showEventsByUnknownUsers])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      // Use search query parameter instead of category path for full-text search
      const params = new URLSearchParams(window.location.search)
      params.set("q", searchTerm.trim())
      navigate(`/m?${params.toString()}`)
    }
  }

  // Update URL when geohash is selected and trigger a navigation event
  const handleGeohashSelect = (geohash: string) => {
    // Don't set wildcard geohashes, just unset
    if (!geohash || geohash === "*") {
      setSelectedGeohash(undefined)
      const params = new URLSearchParams(window.location.search)
      params.delete("g")
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname
      window.history.pushState({}, "", newUrl)
      // Dispatch popstate event to notify other components
      window.dispatchEvent(new PopStateEvent("popstate"))
    } else {
      setSelectedGeohash(geohash)
      const params = new URLSearchParams(window.location.search)
      params.set("g", geohash)
      const newUrl = `${window.location.pathname}?${params}`
      window.history.pushState({}, "", newUrl)
      // Dispatch popstate event to notify other components
      window.dispatchEvent(new PopStateEvent("popstate"))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {includeSearch && (
        <>
          <SearchTabSelector activeTab="market" />

          <div className="w-full p-2">
            <form onSubmit={handleSubmit} className="w-full">
              <label className="input input-bordered flex items-center gap-2 w-full">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="grow"
                  placeholder="Search market..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Icon name="search-outline" className="text-neutral-content/60" />
              </label>
            </form>
          </div>
        </>
      )}

      <div className={includeSearch ? "px-2" : ""}>
        {/* Toggle buttons and category label on same row */}
        <div className="flex justify-between items-center flex-wrap gap-2 mb-4">
          <div className="flex gap-2">
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

          {/* Category, search, and location labels */}
          <div className="flex gap-2 flex-wrap">
            {searchFromUrl && (
              <span className="badge p-4 badge-success badge-lg">
                &quot;{searchFromUrl}&quot;
                <button
                  onClick={() => {
                    // Clear search query from URL
                    const params = new URLSearchParams(window.location.search)
                    params.delete("q")
                    setSearchTerm("")
                    const newUrl = params.toString()
                      ? `${window.location.pathname}?${params}`
                      : window.location.pathname
                    window.history.pushState({}, "", newUrl)
                    window.dispatchEvent(new PopStateEvent("popstate"))
                  }}
                  className="ml-2 hover:text-success-content/80 text-lg"
                >
                  ×
                </button>
              </span>
            )}
            {hasCategory && (
              <span className="badge p-4 badge-primary badge-lg">
                {category}
                <button
                  onClick={() => {
                    // Preserve query params when clearing category
                    const params = new URLSearchParams(window.location.search)
                    const queryString = params.toString()
                    navigate(`/m${queryString ? `?${queryString}` : ""}`)
                  }}
                  className="ml-2 hover:text-primary-content/80 text-lg"
                >
                  ×
                </button>
              </span>
            )}
            {selectedGeohash && (
              <span className="badge p-4 badge-info badge-lg flex items-center gap-1">
                <RiMapPinLine className="w-4 h-4" />
                {selectedGeohash}
                <button
                  onClick={() => {
                    setSelectedGeohash(undefined)
                    const params = new URLSearchParams(window.location.search)
                    params.delete("g")
                    const newUrl = params.toString()
                      ? `${window.location.pathname}?${params}`
                      : window.location.pathname
                    window.history.pushState({}, "", newUrl)
                    window.dispatchEvent(new PopStateEvent("popstate"))
                  }}
                  className="ml-2 hover:text-secondary-content/80 text-lg"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Show categories or map based on toggle */}
        {!showMap && (
          <div
            className={`${categoriesHeight} overflow-y-auto flex flex-wrap gap-2 content-start`}
          >
            {availableTags.map((tag) => (
              <CategoryLabel
                key={tag}
                category={tag}
                isActive={category === tag}
                className="h-fit"
                onClick={(e) => {
                  e.preventDefault()
                  // Preserve query params when navigating
                  const params = new URLSearchParams(window.location.search)
                  const queryString = params.toString()
                  navigate(
                    `/m/${encodeURIComponent(tag)}${queryString ? `?${queryString}` : ""}`
                  )
                }}
              />
            ))}
          </div>
        )}

        {showMap && (
          <GeohashMap
            geohashes={selectedGeohash ? [selectedGeohash] : []}
            feedEvents={mapEvents}
            onGeohashSelect={handleGeohashSelect}
            height={mapHeight}
          />
        )}
      </div>

      {/* Hidden feed to collect events for the map - always render to collect events */}
      <div className="hidden">
        <Feed
          key={category || "all"}
          feedConfig={feedConfig}
          onEvent={async (event) => {
            setMapEvents((prev) => {
              if (prev.some((e) => e.id === event.id)) return prev
              return [...prev.slice(-199), event]
            })

            // Extract and add tags from the event
            const tTags = event.tags.filter((tag) => tag[0] === "t" && tag[1])
            if (tTags.length > 0) {
              await marketStore.addTags(
                tTags.map((tag) => tag[1]),
                event.pubkey
              )
              // Update available tags after adding new ones
              const updatedTags = await marketStore.getTags()
              setAvailableTags(updatedTags)
            }
          }}
        />
      </div>
    </div>
  )
}
