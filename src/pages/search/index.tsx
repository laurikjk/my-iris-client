import {useEffect, useRef} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import useHistoryState from "@/shared/hooks/useHistoryState"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import {useParams} from "@/navigation"
import Widget from "@/shared/components/ui/Widget"
import {Helmet} from "react-helmet"
import {useSettingsStore} from "@/stores/settings"
import {useUIStore} from "@/stores/ui"
import PeopleSearch from "./components/PeopleSearch"
import PostsSearch from "./components/PostsSearch"
import MarketSearch from "./components/MarketSearch"
import MapSearch from "./components/MapSearch"

function SearchPage() {
  const {query} = useParams()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useHistoryState<
    "people" | "posts" | "market" | "map"
  >(query ? "posts" : "people", "searchTab")
  const navItemClicked = useUIStore((state) => state.navItemClicked)

  const {content} = useSettingsStore()
  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useHistoryState(
    !content.hideEventsByUnknownUsers,
    "searchShowEventsByUnknownUsers"
  )

  useEffect(() => {
    if (query) {
      setActiveTab("posts")
    }
  }, [query, setActiveTab])

  // Focus search input when search nav item is clicked
  useEffect(() => {
    if (navItemClicked.path !== "/search") return

    // Focus the input for posts/market tabs
    if (activeTab !== "people") {
      searchInputRef.current?.focus()
    }
  }, [navItemClicked, activeTab])

  const renderSearchContent = () => {
    switch (activeTab) {
      case "people":
        return <PeopleSearch searchInputRef={searchInputRef} />
      case "posts":
        return (
          <PostsSearch
            query={query}
            showEventsByUnknownUsers={showEventsByUnknownUsers}
            searchInputRef={searchInputRef}
          />
        )
      case "market":
        return (
          <MarketSearch
            query={query}
            showEventsByUnknownUsers={showEventsByUnknownUsers}
            searchInputRef={searchInputRef}
          />
        )
      case "map":
        return <MapSearch searchInputRef={searchInputRef} />
      default:
        return null
    }
  }

  const shouldShowUnknownUsersToggle = () => {
    return (activeTab === "posts" || activeTab === "market") && query
  }

  return (
    <div className="flex flex-1 flex-row relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title={query ? `Search: "${query}"` : "Search"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full max-w-screen-lg flex flex-col gap-2 md:pt-2">
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

            {shouldShowUnknownUsersToggle() && (
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

            {renderSearchContent()}
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

export default SearchPage
