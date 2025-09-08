import {useParams} from "@/navigation"
import {useState, useMemo, useEffect} from "react"
import Feed from "@/shared/components/feed/Feed"
import {KIND_TEXT_NOTE, KIND_EPHEMERAL} from "@/utils/constants"
import {ALL_GEOHASHES} from "@/utils/geohash"
import MapWithEvents from "@/shared/components/map/MapWithEvents"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import {Helmet} from "react-helmet"
import {useIsTwoColumnLayout} from "@/shared/hooks/useIsTwoColumnLayout"
import {useUIStore} from "@/stores/ui"

export default function MapPage() {
  const {query} = useParams()
  const isInTwoColumnLayout = useIsTwoColumnLayout()

  // Initialize state properly from route parameter
  const initialGeohashes = useMemo(() => {
    return query ? [query.toLowerCase()] : []
  }, [query])

  const [selectedGeohashes, setSelectedGeohashes] = useState<string[]>(initialGeohashes)
  const displayAs = useUIStore((state) => state.mapDisplayAs)
  const setMapDisplayAs = useUIStore((state) => state.setMapDisplayAs)

  // Update state when route parameter changes
  useEffect(() => {
    const newGeohashes = query ? [query.toLowerCase()] : []
    setSelectedGeohashes(newGeohashes)
  }, [query])

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

    const config = {
      id: `map-search-${geohashes.join(",") || "global"}`,
      name: "Location Feed",
      filter,
      followDistance: 5,
      showRepliedTo: true,
      hideReplies: false,
      displayAs,
    }

    return config
  }, [geohashes, displayAs])

  // If in two-column layout, only show the feed (map interface is in middle column)
  if (isInTwoColumnLayout) {
    return (
      <div className="flex flex-1 flex-row relative h-full">
        <div className="flex flex-col flex-1 h-full relative">
          <Header title={query ? `Map: ${query}` : "Map"} />
          <ScrollablePageContainer className="flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
              <Feed
                key={`right-${geohashes.join(",") || "global"}`}
                feedConfig={{...feedConfig, id: `${feedConfig.id}-right`}}
                showReplies={0}
                borderTopFirst={true}
                showDisplayAsSelector={true}
                displayAs={displayAs}
                onDisplayAsChange={setMapDisplayAs}
              />
            </div>
            <Helmet>
              <title>{query ? `Map: ${query}` : "Map"} / Iris</title>
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
        <Header title={query ? `Map: ${query}` : "Map"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
            <SearchTabSelector activeTab="map" />

            <div className="w-full">
              <div className="mt-4">
                <MapWithEvents
                  selectedGeohashes={geohashes}
                  height="20rem"
                  className="w-full max-w-full"
                  displayAs={displayAs}
                />
                <div className="mt-4">
                  <Feed
                    key={geohashes.join(",") || "global"}
                    feedConfig={feedConfig}
                    showReplies={0}
                    borderTopFirst={true}
                    showDisplayAsSelector={true}
                    displayAs={displayAs}
                    onDisplayAsChange={setMapDisplayAs}
                  />
                </div>
              </div>
            </div>
          </div>
          <Helmet>
            <title>{query ? `Map: ${query}` : "Map"} / Iris</title>
          </Helmet>
        </ScrollablePageContainer>
      </div>
    </div>
  )
}
