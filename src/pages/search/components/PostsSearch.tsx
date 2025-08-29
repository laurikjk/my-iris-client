import {useState, FormEvent, RefObject} from "react"
import {useNavigate} from "@/navigation"
import Feed from "@/shared/components/feed/Feed.tsx"
import AlgorithmicFeed from "@/shared/components/feed/AlgorithmicFeed"
import {KIND_TEXT_NOTE} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"

interface PostsSearchProps {
  query?: string
  showEventsByUnknownUsers: boolean
  searchInputRef: RefObject<HTMLInputElement | null>
}

export default function PostsSearch({
  query,
  showEventsByUnknownUsers,
  searchInputRef,
}: PostsSearchProps) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState(query || "")

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      navigate(`/search/${searchTerm}`)
    }
  }

  if (query) {
    return (
      <Feed
        key={`posts-${query}`}
        feedConfig={{
          name: "Search Results",
          id: `search-posts-${query}`,
          showRepliedTo: false,
          showEventsByUnknownUsers: showEventsByUnknownUsers,
          filter: {
            kinds: [KIND_TEXT_NOTE],
            ...(query.trim() && {search: query}),
          },
        }}
      />
    )
  }

  return (
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
        <AlgorithmicFeed type="popular" displayOptions={{showDisplaySelector: true}} />
      </div>
    </div>
  )
}
