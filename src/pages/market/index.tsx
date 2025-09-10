import {useParams} from "@/navigation"
import {useState, useEffect} from "react"
import Feed from "@/shared/components/feed/Feed"
import {KIND_CLASSIFIED} from "@/utils/constants"
import {useUIStore} from "@/stores/ui"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import {Helmet} from "react-helmet"
import {useIsTwoColumnLayout} from "@/shared/hooks/useIsTwoColumnLayout"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import MarketFilters from "./components/MarketFilters"

export default function MarketPage() {
  const {category} = useParams()
  const isInTwoColumnLayout = useIsTwoColumnLayout()
  const displayAs = useUIStore((state) => state.marketDisplayAs)
  const setMarketDisplayAs = useUIStore((state) => state.setMarketDisplayAs)

  // Get geohash and search query from URL query params
  const [selectedGeohash, setSelectedGeohash] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState<string | undefined>()

  const hasCategory = Boolean(category?.trim())

  // Update selectedGeohash and searchQuery when URL changes
  useEffect(() => {
    const handleLocationChange = () => {
      const params = new URLSearchParams(window.location.search)
      const g = params.get("g")
      const q = params.get("q")
      setSelectedGeohash(g || undefined)
      setSearchQuery(q || undefined)
    }

    // Initial load
    handleLocationChange()

    // Listen for popstate events (browser back/forward)
    window.addEventListener("popstate", handleLocationChange)

    return () => {
      window.removeEventListener("popstate", handleLocationChange)
    }
  }, [])

  // Shared feed component
  const FeedComponent = () => {
    if (hasCategory || selectedGeohash || searchQuery) {
      const filter: NDKFilter = {
        kinds: [KIND_CLASSIFIED],
      }

      if (hasCategory) {
        // Always include both original and lowercase versions
        const tagVariations = [category, category.toLowerCase()]
        // Remove duplicates if original was already lowercase
        filter["#t"] = [...new Set(tagVariations)]
      }

      if (selectedGeohash) {
        filter["#g"] = [selectedGeohash]
      }

      if (searchQuery) {
        // Add search filter for full-text search
        filter.search = searchQuery
      }

      return (
        <Feed
          key={`market-${category || ""}-${selectedGeohash || ""}-${searchQuery || ""}`}
          feedConfig={{
            name: `Market${category ? `: ${category}` : ""}${selectedGeohash ? " (filtered by location)" : ""}${searchQuery ? ` (search: ${searchQuery})` : ""}`,
            id: `search-market-${category || ""}-${selectedGeohash || ""}-${searchQuery || ""}`,
            showRepliedTo: false,
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

  // Generate title with category, location, and search
  const generateTitle = () => {
    let title = "Market"
    const parts = []

    if (searchQuery) {
      parts.push(`"${searchQuery}"`)
    }

    if (category) {
      parts.push(category)
    }

    if (selectedGeohash) {
      parts.push(`#${selectedGeohash}`)
    }

    if (parts.length > 0) {
      title += ": " + parts.join(" • ")
    }

    return title
  }

  const pageTitle = generateTitle()

  // If in two-column layout, only show the feed (controls are in MarketFilters in middle column)
  if (isInTwoColumnLayout) {
    return (
      <div className="flex flex-1 flex-row relative h-full">
        <div className="flex flex-col flex-1 h-full relative">
          <Header title={pageTitle} />
          <ScrollablePageContainer className="flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
              <FeedComponent />
            </div>
            <Helmet>
              <title>{pageTitle} / Iris</title>
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
        <Header title={pageTitle} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
            <MarketFilters
              mapHeight="20rem"
              categoriesHeight="h-80"
              includeSearch={true}
            />

            <div className="mt-4">
              <FeedComponent />
            </div>
          </div>
          <Helmet>
            <title>{pageTitle} / Iris</title>
          </Helmet>
        </ScrollablePageContainer>
      </div>
    </div>
  )
}
