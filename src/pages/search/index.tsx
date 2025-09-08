import {useEffect, useRef, useState, FormEvent} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import useHistoryState from "@/shared/hooks/useHistoryState"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import {useParams, useNavigate} from "@/navigation"
import Widget from "@/shared/components/ui/Widget"
import {Helmet} from "react-helmet"
import {useSettingsStore} from "@/stores/settings"
import {useUIStore} from "@/stores/ui"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Feed from "@/shared/components/feed/Feed"
import {KIND_TEXT_NOTE} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"
import {useIsTwoColumnLayout} from "@/shared/hooks/useIsTwoColumnLayout"
import {HomeRightColumn} from "@/pages/home/components/HomeRightColumn"

function SearchPage() {
  const {query} = useParams()
  const decodedQuery = query ? decodeURIComponent(query) : ""
  const navigate = useNavigate()
  const isInTwoColumnLayout = useIsTwoColumnLayout()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navItemClicked = useUIStore((state) => state.navItemClicked)
  const [searchTerm, setSearchTerm] = useState(decodedQuery)

  const {content} = useSettingsStore()
  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useHistoryState(
    !content.hideEventsByUnknownUsers,
    "searchShowEventsByUnknownUsers"
  )

  // Focus search input when search nav item is clicked
  useEffect(() => {
    if (navItemClicked.path !== "/search") return
    searchInputRef.current?.focus()
  }, [navItemClicked])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      navigate(`/search/${searchTerm}`)
    }
  }

  // If in two-column layout, show the home-style right column
  if (isInTwoColumnLayout) {
    return <HomeRightColumn />
  }

  // Single column layout - show full interface
  return (
    <div className="flex flex-1 flex-row relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title={decodedQuery ? `Search: "${decodedQuery}"` : "Search"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
            <SearchTabSelector activeTab="posts" />

            {decodedQuery && (
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

            {decodedQuery ? (
              <Feed
                key={`posts-${decodedQuery}`}
                feedConfig={{
                  name: "Search Results",
                  id: `search-posts-${decodedQuery}`,
                  showRepliedTo: false,
                  showEventsByUnknownUsers: showEventsByUnknownUsers,
                  filter: {
                    kinds: [KIND_TEXT_NOTE],
                    ...(decodedQuery.trim() && {search: decodedQuery}),
                  },
                }}
              />
            ) : (
              <div className="w-full">
                <div className="w-full p-2">
                  <form onSubmit={handleSubmit} className="w-full">
                    <label className="input input-bordered flex items-center gap-2 w-full">
                      <input
                        ref={searchInputRef}
                        type="text"
                        className="grow"
                        placeholder="Search posts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <Icon name="search-outline" className="text-neutral-content/60" />
                    </label>
                  </form>
                </div>

                <div className="mt-4">
                  <AlgorithmicFeed
                    type="popular"
                    displayOptions={{showDisplaySelector: true}}
                  />
                </div>
              </div>
            )}
          </div>
          <Helmet>
            <title>{decodedQuery ? `Search: ${decodedQuery}` : `Search`} / Iris</title>
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
