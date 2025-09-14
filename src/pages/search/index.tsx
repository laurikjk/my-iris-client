import {useEffect, useRef, useState, FormEvent, useMemo} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {useSearchStore} from "@/stores/search"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import {useParams, useNavigate} from "@/navigation"
import Widget from "@/shared/components/ui/Widget"
import {Helmet} from "react-helmet"
import {useUIStore} from "@/stores/ui"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Feed from "@/shared/components/feed/Feed"
import {KIND_TEXT_NOTE} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"
import {useIsTwoColumnLayout} from "@/shared/hooks/useIsTwoColumnLayout"
import {HomeRightColumn} from "@/pages/home/components/HomeRightColumn"
import {handleNostrIdentifier} from "@/utils/handleNostrIdentifier"

function SearchPage() {
  const {query} = useParams()
  const decodedQuery = query ? decodeURIComponent(query) : ""
  const navigate = useNavigate()
  const isInTwoColumnLayout = useIsTwoColumnLayout()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navItemClicked = useUIStore((state) => state.navItemClicked)

  // Use store for persistent state
  const searchQuery = useSearchStore((state) => state.searchQuery)
  const setSearchQuery = useSearchStore((state) => state.setSearchQuery)
  const showEventsByUnknownUsers = useSearchStore(
    (state) => state.showEventsByUnknownUsers
  )
  const setShowEventsByUnknownUsers = useSearchStore(
    (state) => state.setShowEventsByUnknownUsers
  )

  // Initialize from URL or store
  const [searchTerm, setSearchTerm] = useState(() => {
    // If we have a query in the URL, use that
    if (decodedQuery) return decodedQuery
    // Otherwise use the stored search query
    return searchQuery
  })

  // Update store when URL query changes (navigation)
  useEffect(() => {
    if (decodedQuery && decodedQuery !== searchQuery) {
      setSearchQuery(decodedQuery)
      setSearchTerm(decodedQuery)
    }
  }, [decodedQuery, searchQuery, setSearchQuery])

  // Focus search input when search nav item is clicked
  useEffect(() => {
    if (navItemClicked.path !== "/search") return
    searchInputRef.current?.focus()
  }, [navItemClicked])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const currentValue = searchTerm
    // Clear immediately for hex-like values
    if (currentValue.match(/^[0-9a-fA-F]{64}$/)) {
      setSearchTerm("")
    }
    await handleNostrIdentifier({
      input: currentValue,
      navigate,
      clearInput: () => setSearchTerm(""),
      onTextSearch: (query) => {
        setSearchQuery(query)
        navigate(`/search/${query}`)
      },
    })
  }

  // Memoize the feed config to prevent unnecessary re-renders
  // Use the actual query being displayed (from URL or store)
  const activeQuery = decodedQuery || searchQuery
  const feedConfig = useMemo(() => {
    if (!activeQuery) return null
    return {
      name: "Search Results",
      id: `search-posts-${activeQuery}`,
      showRepliedTo: false,
      followDistance: showEventsByUnknownUsers ? undefined : 5,
      filter: {
        kinds: [KIND_TEXT_NOTE],
        ...(activeQuery.trim() && {search: activeQuery}),
      },
    }
  }, [activeQuery, showEventsByUnknownUsers])

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
                    onPaste={async (e) => {
                      const pastedText = e.clipboardData.getData("text")
                      e.preventDefault()

                      // Check if pasted value is a Nostr identifier
                      await handleNostrIdentifier({
                        input: pastedText,
                        navigate,
                        clearInput: () => setSearchTerm(""),
                        onTextSearch: (query) => {
                          // For regular text, set it
                          setSearchTerm(query)
                        },
                      })
                    }}
                  />
                  <Icon name="search-outline" className="text-neutral-content/60" />
                </label>
              </form>
            </div>

            {activeQuery && (
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

            {feedConfig ? (
              <Feed feedConfig={feedConfig} />
            ) : (
              <div className="mt-4">
                <AlgorithmicFeed
                  type="popular"
                  displayOptions={{showDisplaySelector: true}}
                />
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
