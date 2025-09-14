import {useEffect, useRef, useState, FormEvent, useMemo, memo} from "react"
import {useParams, useNavigate} from "@/navigation"
import {useUIStore} from "@/stores/ui"
import {useSearchStore} from "@/stores/search"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Feed from "@/shared/components/feed/Feed"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {KIND_TEXT_NOTE} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"

const SearchFilters = memo(function SearchFilters() {
  const {query} = useParams()
  const decodedQuery = query ? decodeURIComponent(query) : ""
  const navigate = useNavigate()
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      setSearchQuery(searchTerm.trim())
      navigate(`/search/${searchTerm}`)
    }
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

  return (
    <div className="flex flex-col gap-2 h-full">
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
            />
            <Icon name="search-outline" className="text-neutral-content/60" />
          </label>
        </form>
      </div>

      {activeQuery && (
        <div className="flex items-center gap-2 p-2">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={showEventsByUnknownUsers}
            onChange={(e) => setShowEventsByUnknownUsers(e.target.checked)}
          />
          <span className="text-sm">Show posts from unknown users</span>
        </div>
      )}

      <div className="flex-1 w-full">
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
    </div>
  )
})

export default SearchFilters
