import {useMemo, useState, useEffect, FormEvent, useRef} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import useHistoryState from "@/shared/hooks/useHistoryState"
import SearchBox from "@/shared/components/ui/SearchBox"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import {NDKFilter} from "@nostr-dev-kit/ndk"
import Feed from "@/shared/components/feed/Feed.tsx"
import {useParams, useNavigate} from "@/navigation"
import Widget from "@/shared/components/ui/Widget"
import {Helmet} from "react-helmet"
import {useSettingsStore} from "@/stores/settings"
import {useUIStore} from "@/stores/ui"
import {KIND_CLASSIFIED, KIND_TEXT_NOTE} from "@/utils/constants"

function SearchPage() {
  const {query} = useParams()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState(query || "")
  const [activeTab, setActiveTab] = useHistoryState<"people" | "posts" | "market">(
    query ? "posts" : "people",
    "searchTab"
  )
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
              <div className="mt-4">
                <AlgorithmicFeed
                  type="popular"
                  displayOptions={{showDisplaySelector: false}}
                />
              </div>
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

export default SearchPage
