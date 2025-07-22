import {useMemo, useState, useEffect, FormEvent, useCallback} from "react"
import RightColumn from "@/shared/components/RightColumn.tsx"
import PopularFeed from "@/shared/components/feed/PopularFeed"
import useHistoryState from "@/shared/hooks/useHistoryState"
import SearchBox from "@/shared/components/ui/SearchBox"
import Header from "@/shared/components/header/Header"
import {NDKFilter, NDKEvent} from "@nostr-dev-kit/ndk"
import Feed from "@/shared/components/feed/Feed.tsx"
import {useParams, useNavigate} from "react-router"
import Widget from "@/shared/components/ui/Widget"
import {Helmet} from "react-helmet"

function SearchPage() {
  const {query} = useParams()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState(query || "")
  const [activeTab, setActiveTab] = useHistoryState<"people" | "posts" | "market">(
    query ? "posts" : "people",
    "searchTab"
  )

  useEffect(() => {
    setSearchTerm(query?.toLowerCase() || "")
  }, [query])

  const filters: NDKFilter = useMemo(
    () => ({
      kinds: activeTab === "market" ? [30402] : [1],
      search: query,
    }),
    [query, activeTab]
  )

  const displayFilterFn = useCallback(
    (event: NDKEvent) =>
      (event.content + JSON.stringify(event.tags)).toLowerCase().includes(searchTerm),
    [searchTerm]
  )

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (searchTerm !== query) {
      navigate(`/search/${searchTerm}`)
    }
  }

  return (
    <div className="flex flex-row">
      <div key={query} className="flex flex-col items-center flex-1">
        <Header title={query ? `Search: "${query}"` : "Search"} />
        <div className="p-2 flex-1 w-full max-w-screen-lg flex flex-col gap-4">
          {activeTab === "people" ? (
            <SearchBox searchNotes={true} maxResults={10} />
          ) : (
            <form onSubmit={handleSubmit} className="flex w-full">
              <input
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
          <div className="px-2 flex gap-2 overflow-x-auto">
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
          {query && (
            <Feed
              key={`${activeTab}-${query}`}
              filters={filters}
              displayFilterFn={displayFilterFn}
              showRepliedTo={false}
              showFilters={true}
              cacheKey={`search-${activeTab}-${query}`}
            />
          )}
          {!query && (
            <div className="mt-4">
              <PopularFeed small={false} />
            </div>
          )}
        </div>
        <Helmet>
          <title>{query ? `Search: ${query}` : `Search`} / Iris</title>
        </Helmet>
      </div>
      <RightColumn>
        {() => (
          <>
            <Widget title="Popular">
              <PopularFeed />
            </Widget>
          </>
        )}
      </RightColumn>
    </div>
  )
}

export default SearchPage
