import {useParams, useNavigate} from "@/navigation"
import {useRef, useMemo, useState, useEffect} from "react"
import {useSearch} from "@/shared/hooks/useSearch"
import {UserRow} from "@/shared/components/user/UserRow"
import InfiniteScroll from "@/shared/components/ui/InfiniteScroll"
import {useSocialGraph} from "@/utils/socialGraph"
import {nip19} from "nostr-tools"
import Icon from "@/shared/components/Icons/Icon"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import {SocialGraphWidget} from "@/shared/components/SocialGraphWidget"
import {Helmet} from "react-helmet"
import {useIsTwoColumnLayout} from "@/shared/hooks/useIsTwoColumnLayout"
import {HomeRightColumn} from "@/pages/home/components/HomeRightColumn"
import {handleNostrIdentifier} from "@/utils/handleNostrIdentifier"

export default function UserSearchPage() {
  const socialGraph = useSocialGraph()
  const {query} = useParams()
  const decodedQuery = query ? decodeURIComponent(query) : ""
  const navigate = useNavigate()
  const isInTwoColumnLayout = useIsTwoColumnLayout()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [displayCount, setDisplayCount] = useState(20)
  const [searchValue, setSearchValue] = useState(decodedQuery)

  // Update search value when URL changes
  useEffect(() => {
    setSearchValue(decodedQuery)
  }, [decodedQuery])

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

  // Sync our local state with the search hook (one way only)
  useEffect(() => {
    peopleSearch.setValue(searchValue)
  }, [searchValue])

  const rootUser = socialGraph.getRoot()
  const follows = socialGraph.getFollowedByUser(rootUser)

  const displayUsers = useMemo(() => {
    if (searchValue.trim()) {
      // Show search results if we have any, otherwise show empty for search mode
      return peopleSearch.searchResults.map((result) => ({
        pubkey: result.pubKey,
        followedByCount: socialGraph.followedByFriends(result.pubKey).size,
      }))
    }

    // Show follows list only when no search term
    if (!follows) return []

    const recentPubKeys = new Set(peopleSearch.recentSearches.map((r) => r.pubKey))

    return Array.from(follows)
      .filter((pubkey) => !recentPubKeys.has(pubkey))
      .map((pubkey) => ({
        pubkey,
        followedByCount: socialGraph.followedByFriends(pubkey).size,
      }))
      .sort(() => Math.random() - 0.5)
  }, [
    follows,
    socialGraph,
    rootUser,
    searchValue,
    peopleSearch.searchResults,
    peopleSearch.recentSearches,
  ])

  const loadMore = () => {
    if (displayCount < displayUsers.length) {
      setDisplayCount((prev) => Math.min(prev + 20, displayUsers.length))
    }
  }

  // If in two-column layout, show the home-style right column
  if (isInTwoColumnLayout) {
    return <HomeRightColumn />
  }

  return (
    <div className="flex flex-1 flex-row relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title={decodedQuery ? `People: ${decodedQuery}` : "People"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
            <SearchTabSelector activeTab="people" />

            <div className="w-full">
              <div className="w-full p-2">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    await handleNostrIdentifier({
                      input: searchValue,
                      navigate,
                      clearInput: () => setSearchValue(""),
                      onTextSearch: (query) => {
                        navigate(`/u/${encodeURIComponent(query)}`)
                      },
                    })
                  }}
                  className="w-full"
                >
                  <label className="input input-bordered flex items-center gap-2 w-full">
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="grow"
                      placeholder="Search people..."
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      onPaste={async (e) => {
                        const pastedText = e.clipboardData.getData("text")
                        e.preventDefault()

                        await handleNostrIdentifier({
                          input: pastedText,
                          navigate,
                          clearInput: () => setSearchValue(""),
                          onTextSearch: (query) => {
                            // For regular text, set it
                            setSearchValue(query)
                          },
                        })
                      }}
                    />
                    <Icon name="search-outline" className="text-neutral-content/60" />
                  </label>
                </form>
              </div>

              {!searchValue.trim() && <SocialGraphWidget background={false} />}

              {!searchValue.trim() && peopleSearch.recentSearches.length > 0 && (
                <div className="px-4 mt-4">
                  <div className="menu-title text-sm px-0 py-2">Recent</div>
                  <div className="flex flex-col gap-2">
                    {peopleSearch.recentSearches.map((result) => (
                      <UserRow
                        key={result.pubKey}
                        pubKey={result.pubKey}
                        linkToProfile={true}
                      />
                    ))}
                  </div>
                </div>
              )}

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
          </div>
          <Helmet>
            <title>{decodedQuery ? `People: ${decodedQuery}` : "People"} / Iris</title>
          </Helmet>
        </ScrollablePageContainer>
      </div>
    </div>
  )
}
