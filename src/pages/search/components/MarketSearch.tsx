import {useState, FormEvent, RefObject, useEffect} from "react"
import Feed from "@/shared/components/feed/Feed.tsx"
import {KIND_CLASSIFIED} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"
import {marketStore} from "@/stores/marketstore"

interface MarketSearchProps {
  query?: string
  showEventsByUnknownUsers: boolean
  searchInputRef: RefObject<HTMLInputElement | null>
}

export default function MarketSearch({
  query,
  showEventsByUnknownUsers,
  searchInputRef,
}: MarketSearchProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [submittedSearch, setSubmittedSearch] = useState(query || "")
  const [searchTag, setSearchTag] = useState("")
  const [availableTags, setAvailableTags] = useState<string[]>([])

  useEffect(() => {
    const loadTags = async () => {
      const tags = await marketStore.getTags()
      setAvailableTags(tags)
    }
    loadTags()
  }, [])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      setSubmittedSearch(searchTerm)
    }
  }

  const hasSearchTerm = Boolean(submittedSearch?.trim())
  const hasSearchTag = Boolean(searchTag?.trim())

  return (
    <div className="w-full">
      <div className="w-full p-2">
        <form onSubmit={handleSubmit} className="w-full">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <input
              ref={searchInputRef}
              type="text"
              className="grow"
              placeholder="Search market..."
              value={hasSearchTerm ? submittedSearch : searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                // Clear submitted search when user starts typing again
                if (hasSearchTerm) {
                  setSubmittedSearch("")
                }
              }}
            />
            <Icon name="search-outline" className="text-neutral-content/60" />
          </label>
        </form>
      </div>

      {availableTags.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-base-content">Categories</h3>
            {hasSearchTag && (
              <button
                onClick={() => setSearchTag("")}
                className="text-sm text-base-content/60 hover:text-base-content"
              >
                Clear
              </button>
            )}
          </div>
          <div className="h-32 overflow-y-auto flex flex-wrap gap-2 content-start">
            {availableTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  if (searchTag === tag) {
                    setSearchTag("")
                  } else {
                    setSearchTag(tag)
                    setSearchTerm("")
                    setSubmittedSearch("")
                  }
                  if (searchInputRef.current) {
                    searchInputRef.current.focus()
                  }
                }}
                className={`badge cursor-pointer transition-colors h-fit ${
                  searchTag === tag
                    ? "badge-primary"
                    : "badge-outline hover:bg-primary hover:text-primary-content hover:border-primary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        {(() => {
          if (hasSearchTerm) {
            return (
              <Feed
                key={`market-${submittedSearch}`}
                feedConfig={{
                  name: "Market Search Results",
                  id: `search-market-${submittedSearch}`,
                  showRepliedTo: false,
                  showEventsByUnknownUsers: showEventsByUnknownUsers,
                  filter: {
                    kinds: [KIND_CLASSIFIED],
                    search: submittedSearch,
                  },
                }}
              />
            )
          }
          if (hasSearchTag) {
            return (
              <Feed
                key={`market-tag-${searchTag}`}
                feedConfig={{
                  name: `Market: ${searchTag}`,
                  id: `search-market-tag-${searchTag}`,
                  showRepliedTo: false,
                  showEventsByUnknownUsers: showEventsByUnknownUsers,
                  filter: {
                    kinds: [KIND_CLASSIFIED],
                    "#t": [searchTag],
                  },
                }}
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
            />
          )
        })()}
      </div>
    </div>
  )
}
