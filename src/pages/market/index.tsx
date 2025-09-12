import {useParams} from "@/navigation"
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

  // Parse URL params directly without state to avoid stale values
  const params = new URLSearchParams(window.location.search)
  const selectedGeohash = params.get("g") || undefined
  const searchQuery = params.get("q") || undefined
  const additionalTags = params.get("t")?.split(",").filter(Boolean) || []

  const hasCategory = Boolean(category?.trim())

  // Shared feed component
  const FeedComponent = () => {
    if (hasCategory || additionalTags.length > 0 || selectedGeohash || searchQuery) {
      const filter: NDKFilter = {
        kinds: [KIND_CLASSIFIED],
      }

      // Collect all selected tags
      const allTags: string[] = []
      if (hasCategory) {
        allTags.push(category)
      }
      allTags.push(...additionalTags)

      if (allTags.length > 0) {
        // For multiple tags, use search to implement AND logic
        // The search filter in useFeedEvents already handles hashtag AND logic
        const searchTerms = allTags.map((tag) => `#${tag}`).join(" ")
        filter.search = searchQuery ? `${searchQuery} ${searchTerms}` : searchTerms
      } else if (searchQuery) {
        filter.search = searchQuery
      }

      if (selectedGeohash) {
        filter["#g"] = [selectedGeohash]
      }

      const feedConfig = {
        name: `Market${allTags.length > 0 ? `: ${allTags.join(", ")}` : ""}${selectedGeohash ? " (filtered by location)" : ""}${searchQuery ? ` (search: ${searchQuery})` : ""}`,
        id: `search-market-${allTags.join("-")}-${selectedGeohash || ""}-${searchQuery || ""}`,
        showRepliedTo: false,
        filter,
      }

      return (
        <Feed
          key={`market-${allTags.join("-")}-${selectedGeohash || ""}-${searchQuery || ""}`}
          feedConfig={feedConfig}
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
