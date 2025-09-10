import {useEffect, useRef, useState, FormEvent} from "react"
import {useParams, useNavigate} from "@/navigation"
import {useUIStore} from "@/stores/ui"
import useHistoryState from "@/shared/hooks/useHistoryState"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import Feed from "@/shared/components/feed/Feed"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {KIND_TEXT_NOTE} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"

export default function SearchFilters() {
  const {query} = useParams()
  const decodedQuery = query ? decodeURIComponent(query) : ""
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navItemClicked = useUIStore((state) => state.navItemClicked)
  const [searchTerm, setSearchTerm] = useState(decodedQuery)

  // Search should show all events regardless of follow distance
  const [showEventsByUnknownUsers, setShowEventsByUnknownUsers] = useHistoryState(
    true,
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

      {decodedQuery && (
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
        {decodedQuery ? (
          <Feed
            key={`posts-${decodedQuery}`}
            feedConfig={{
              name: "Search Results",
              id: `search-posts-${decodedQuery}`,
              showRepliedTo: false,
              followDistance: showEventsByUnknownUsers ? undefined : 5,
              filter: {
                kinds: [KIND_TEXT_NOTE],
                ...(decodedQuery.trim() && {search: decodedQuery}),
              },
            }}
          />
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
}
