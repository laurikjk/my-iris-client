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

  setRecentSearches: (searches: CustomSearchResult[]) => void
  setSearchQuery: (query: string) => void
  setShowEventsByUnknownUsers: (show: boolean) => void
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => {
      const initialState = {
        recentSearches: [] as CustomSearchResult[],
        searchQuery: "",
        showEventsByUnknownUsers: false,
      }

      const actions = {
        setRecentSearches: (recentSearches: CustomSearchResult[]) =>
          set({recentSearches}),
        setSearchQuery: (searchQuery: string) => set({searchQuery}),
        setShowEventsByUnknownUsers: (showEventsByUnknownUsers: boolean) =>
          set({showEventsByUnknownUsers}),
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
