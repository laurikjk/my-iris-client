import {useParams, useNavigate} from "@/navigation"
import {useRef, useState, useEffect, FormEvent} from "react"
import Feed from "@/shared/components/feed/Feed"
import {KIND_CLASSIFIED} from "@/utils/constants"
import Icon from "@/shared/components/Icons/Icon"
import {useSettingsStore} from "@/stores/settings"
import {useUIStore} from "@/stores/ui"
import {marketStore} from "@/stores/marketstore"
import Header from "@/shared/components/header/Header"
import {ScrollablePageContainer} from "@/shared/components/layout/ScrollablePageContainer"
import SearchTabSelector from "@/shared/components/search/SearchTabSelector"
import {Helmet} from "react-helmet"
import {useIsTwoColumnLayout} from "@/shared/hooks/useIsTwoColumnLayout"

export default function MarketPage() {
  const {category} = useParams()
  const navigate = useNavigate()
  const isInTwoColumnLayout = useIsTwoColumnLayout()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const showEventsByUnknownUsers = useSettingsStore(
    (state) => !state.content.hideEventsByUnknownUsers
  )
  const [searchTerm, setSearchTerm] = useState("")
  const [submittedSearch, setSubmittedSearch] = useState("")
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const displayAs = useUIStore((state) => state.marketDisplayAs)
  const setMarketDisplayAs = useUIStore((state) => state.setMarketDisplayAs)

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
  const hasCategory = Boolean(category?.trim())

  // If in two-column layout, only show the feed (categories interface is in middle column)
  if (isInTwoColumnLayout) {
    const feedComponent = (() => {
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
            displayAs={displayAs}
            onDisplayAsChange={setMarketDisplayAs}
            showDisplayAsSelector={true}
          />
        )
      }
      if (hasCategory) {
        const tagVariations = [category]
        const lowerTag = category.toLowerCase()
        if (lowerTag !== category) {
          tagVariations.push(lowerTag)
        }

        return (
          <Feed
            key={`market-tag-${category}`}
            feedConfig={{
              name: `Market: ${category}`,
              id: `search-market-tag-${category}`,
              showRepliedTo: false,
              showEventsByUnknownUsers: showEventsByUnknownUsers,
              filter: {
                kinds: [KIND_CLASSIFIED],
                "#t": tagVariations,
              },
            }}
            displayAs={displayAs}
            onDisplayAsChange={setMarketDisplayAs}
            showDisplayAsSelector={true}
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
          displayAs={displayAs}
          onDisplayAsChange={setMarketDisplayAs}
          showDisplayAsSelector={true}
        />
      )
    })()

    return (
      <div className="flex flex-1 flex-row relative h-full">
        <div className="flex flex-col flex-1 h-full relative">
          <Header title={category ? `Market: ${category}` : "Market"} />
          <ScrollablePageContainer className="flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
              {feedComponent}
            </div>
            <Helmet>
              <title>{category ? `Market: ${category}` : "Market"} / Iris</title>
            </Helmet>
          </ScrollablePageContainer>
        </div>
      </div>
    )
  }

  // Single column layout - show full interface
  return (
    <div className="flex flex-1 flex-row relative h-full">
      <div className="flex flex-col flex-1 h-full relative">
        <Header title={category ? `Market: ${category}` : "Market"} />
        <ScrollablePageContainer className="flex flex-col items-center">
          <div className="flex-1 w-full flex flex-col gap-2 md:pt-2">
            <SearchTabSelector activeTab="market" />

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
                      if (hasSearchTerm) {
                        setSubmittedSearch("")
                      }
                    }}
                  />
                  <Icon name="search-outline" className="text-neutral-content/60" />
                </label>
              </form>
            </div>

            <div className="px-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-lg font-semibold text-base-content">Categories</h3>
                {hasCategory && (
                  <button
                    onClick={() => navigate("/m")}
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
                      navigate(`/m/${encodeURIComponent(tag)}`)
                    }}
                    className={`badge cursor-pointer transition-colors h-fit ${
                      category === tag
                        ? "badge-primary"
                        : "badge-outline hover:bg-primary hover:text-primary-content hover:border-primary"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

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
                      displayAs={displayAs}
                      onDisplayAsChange={setMarketDisplayAs}
                      showDisplayAsSelector={true}
                    />
                  )
                }
                if (hasCategory) {
                  const tagVariations = [category]
                  const lowerTag = category.toLowerCase()
                  if (lowerTag !== category) {
                    tagVariations.push(lowerTag)
                  }

                  return (
                    <Feed
                      key={`market-tag-${category}`}
                      feedConfig={{
                        name: `Market: ${category}`,
                        id: `search-market-tag-${category}`,
                        showRepliedTo: false,
                        showEventsByUnknownUsers: showEventsByUnknownUsers,
                        filter: {
                          kinds: [KIND_CLASSIFIED],
                          "#t": tagVariations,
                        },
                      }}
                      displayAs={displayAs}
                      onDisplayAsChange={setMarketDisplayAs}
                      showDisplayAsSelector={true}
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
                    displayAs={displayAs}
                    onDisplayAsChange={setMarketDisplayAs}
                    showDisplayAsSelector={true}
                  />
                )
              })()}
            </div>
          </div>
          <Helmet>
            <title>{category ? `Market: ${category}` : "Market"} / Iris</title>
          </Helmet>
        </ScrollablePageContainer>
      </div>
    </div>
  )
}
