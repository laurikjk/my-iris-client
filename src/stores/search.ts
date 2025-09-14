import {SearchResult} from "@/utils/profileSearch"
import {persist} from "zustand/middleware"
import {create} from "zustand"

export type CustomSearchResult = SearchResult & {
  query?: string
  pubKey: string
}

interface SearchState {
  recentSearches: CustomSearchResult[]
  searchQuery: string
  showEventsByUnknownUsers: boolean
  selectedRelayUrl: string

  setRecentSearches: (searches: CustomSearchResult[]) => void
  setSearchQuery: (query: string) => void
  setShowEventsByUnknownUsers: (show: boolean) => void
  setSelectedRelayUrl: (url: string) => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => {
      const initialState = {
        recentSearches: [] as CustomSearchResult[],
        searchQuery: "",
        showEventsByUnknownUsers: false,
        selectedRelayUrl: "",
      }

      const actions = {
        setRecentSearches: (recentSearches: CustomSearchResult[]) =>
          set({recentSearches}),
        setSearchQuery: (searchQuery: string) => set({searchQuery}),
        setShowEventsByUnknownUsers: (showEventsByUnknownUsers: boolean) =>
          set({showEventsByUnknownUsers}),
        setSelectedRelayUrl: (selectedRelayUrl: string) => set({selectedRelayUrl}),
      }

      return {
        ...initialState,
        ...actions,
      }
    },
    {
      name: "search-storage",
    }
  )
)
