import {useMemo, useState, RefObject} from "react"
import {useSearch} from "@/shared/hooks/useSearch"
import {UserRow} from "@/shared/components/user/UserRow"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import socialGraph from "@/utils/socialGraph"
import {nip19} from "nostr-tools"
import {useNavigate} from "@/navigation"
import Icon from "@/shared/components/Icons/Icon"

interface PeopleSearchProps {
  searchInputRef: RefObject<HTMLInputElement | null>
}

export default function PeopleSearch({searchInputRef}: PeopleSearchProps) {
  const navigate = useNavigate()
  const [displayCount, setDisplayCount] = useState(20)

  const peopleSearch = useSearch({
    maxResults: 10,
    onSelect: (pubKey: string) => {
      try {
        navigate(`/${nip19.npubEncode(pubKey)}`)
      } catch (error) {
        console.error("Error encoding pubkey:", error)
        navigate(`/${pubKey}`)
      }
    },
  })

  const graph = socialGraph()
  const rootUser = graph.getRoot()
  const follows = graph.getFollowedByUser(rootUser)

  const displayUsers = useMemo(() => {
    if (peopleSearch.value.trim()) {
      return peopleSearch.searchResults.map((result) => ({
        pubkey: result.pubKey,
        followedByCount: graph.followedByFriends(result.pubKey).size,
      }))
    }

    if (!follows) return []

    return Array.from(follows)
      .map((pubkey) => ({
        pubkey,
        followedByCount: graph.followedByFriends(pubkey).size,
      }))
      .sort((a, b) => b.followedByCount - a.followedByCount)
  }, [follows, graph, rootUser, peopleSearch.value, peopleSearch.searchResults])

  const loadMore = () => {
    if (displayCount < displayUsers.length) {
      setDisplayCount((prev) => Math.min(prev + 20, displayUsers.length))
    }
  }

  return (
    <div className="w-full">
      <div className="w-full p-2">
        <label className="input input-bordered flex items-center gap-2 w-full">
          <input
            ref={searchInputRef}
            type="text"
            className="grow"
            placeholder="Search people..."
            value={peopleSearch.value}
            onChange={(e) => peopleSearch.setValue(e.target.value)}
          />
          <Icon name="search-outline" className="text-neutral-content/60" />
        </label>
      </div>

      <div className="mt-4">
        <InfiniteScroll onLoadMore={loadMore}>
          <div className="flex flex-col gap-2 px-4">
            {displayUsers.slice(0, displayCount).map(({pubkey}) => (
              <UserRow key={pubkey} pubKey={pubkey} linkToProfile={true} />
            ))}
          </div>
        </InfiniteScroll>
      </div>
    </div>
  )
}
