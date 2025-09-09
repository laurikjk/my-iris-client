import {useParams, useNavigate} from "@/navigation"
import {useRef, useState, useEffect, FormEvent} from "react"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Icon from "@/shared/components/Icons/Icon"
import {marketStore} from "@/stores/marketstore"
import {GeohashMap} from "@/shared/components/geohash/GeohashMap"
import {NDKEvent, NDKFilter} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_CLASSIFIED} from "@/utils/constants"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [mapEvents, setMapEvents] = useState<NDKEvent[]>([])

  // Get geohash from URL query params
  const urlParams = new URLSearchParams(window.location.search)
  const geohashFromUrl = urlParams.get("g")
  const [selectedGeohash, setSelectedGeohash] = useState<string | undefined>(
    geohashFromUrl || undefined
  )

  const hasCategory = Boolean(category?.trim())

  // Show map by default when category is selected
  const [showMap, setShowMap] = useState(hasCategory)

  // Update showMap when category changes
  useEffect(() => {
    setShowMap(Boolean(category?.trim()))
  }, [category])

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
      navigate(`/m/${encodeURIComponent(searchTerm.trim())}`)
    }
  }

  // Update URL when geohash is selected
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
    } else {
      setSelectedGeohash(geohash)
      const params = new URLSearchParams(window.location.search)
      params.set("g", geohash)
      const newUrl = `${window.location.pathname}?${params}`
      window.history.pushState({}, "", newUrl)
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
          
          {/* Category label with X button when category is selected */}
          {hasCategory && (
            <span className="badge p-4 badge-primary badge-lg">
              {category}
              <button
                onClick={() => navigate("/m")}
                className="ml-2 hover:text-primary-content/80 text-lg"
              >
                ×
              </button>
            </span>
          )}
        </div>

        {/* Show categories or map based on toggle */}
        {!showMap && (
          <div
            className={`${categoriesHeight} overflow-y-auto flex flex-wrap gap-2 content-start`}
          >
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

        {showMap && (
          <GeohashMap
            geohashes={selectedGeohash ? [selectedGeohash] : []}
            feedEvents={mapEvents}
            onGeohashSelect={handleGeohashSelect}
            height={mapHeight}
          />
        )}
      </div>
    </div>
  )
}
