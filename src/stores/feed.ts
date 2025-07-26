import {persist} from "zustand/middleware"
import {create} from "zustand"

interface TabFilter {
  kinds?: number[]
  since?: number
  limit?: number
  search?: string
}

interface TabConfig {
  name: string
  id: string
  customName?: string
  showRepliedTo?: boolean
  hideReplies?: boolean
  filter?: TabFilter
  sortLikedPosts?: boolean
  // Store filter criteria as serializable data
  followDistance?: number
  requiresMedia?: boolean
  requiresReplies?: boolean
  excludeSeen?: boolean
  showEventsByUnknownUsers?: boolean
  relayUrls?: string[]
}

interface FeedState {
  activeHomeTab: string
  displayCount: number
  feedDisplayAs: "list" | "grid"
  enabledFeedIds: string[]
  tabConfigs: Record<string, TabConfig>

  setActiveHomeTab: (tab: string) => void
  setDisplayCount: (count: number) => void
  incrementDisplayCount: (increment: number) => void
  setFeedDisplayAs: (displayAs: "list" | "grid") => void
  setEnabledFeedIds: (feedIds: string[]) => void
  reorderFeeds: (startIndex: number, endIndex: number) => void
  toggleFeedEnabled: (feedId: string) => void
  deleteFeed: (feedId: string) => void
  saveFeedConfig: (feedId: string, config: Partial<TabConfig>) => void
  loadFeedConfig: (feedId: string) => TabConfig | undefined
  getAllFeedConfigs: () => TabConfig[]
  resetAllFeedsToDefaults: () => void
}

const defaultTabConfigs: Record<string, TabConfig> = {
  unseen: {
    name: "Unseen",
    id: "unseen",
    showRepliedTo: false,
    excludeSeen: true,
    hideReplies: true,
    filter: {
      kinds: [1, 6],
      limit: 100,
    },
    followDistance: 1,
  },
  popular: {
    name: "Popular",
    id: "popular",
    filter: {
      kinds: [6, 7],
      since: Math.floor(Date.now() / 1000 - 60 * 60 * 24),
      limit: 300,
    },
    followDistance: 2,
    sortLikedPosts: true,
  },
  latest: {
    name: "Latest",
    id: "latest",
    showRepliedTo: false,
    followDistance: 1,
    hideReplies: true,
    filter: {
      kinds: [1],
      limit: 100,
    },
  },
  market: {
    name: "Market",
    id: "market",
    showRepliedTo: false,
    filter: {
      kinds: [30402],
      limit: 100,
    },
    followDistance: 3,
    hideReplies: true,
  },
  replies: {
    name: "Replies",
    id: "replies",
    followDistance: 1,
    requiresReplies: true,
    filter: {
      kinds: [1],
      limit: 100,
    },
  },
  media: {
    name: "Media",
    id: "media",
    showRepliedTo: false,
    requiresMedia: true,
    hideReplies: true,
    filter: {
      kinds: [1],
      limit: 100,
    },
  },
  adventure: {
    name: "Adventure",
    id: "adventure",
    showRepliedTo: false,
    filter: {
      kinds: [1],
      limit: 100,
    },
    followDistance: 5,
    hideReplies: true,
  },
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => {
      const initialState = {
        activeHomeTab: "unseen",
        displayCount: 20,
        feedDisplayAs: "list" as const,
        enabledFeedIds: [
          "unseen",
          "popular",
          "latest",
          "market",
          "replies",
          "media",
          "adventure",
        ],
        tabConfigs: defaultTabConfigs,
      }

      const actions = {
        setActiveHomeTab: (activeHomeTab: string) => set({activeHomeTab}),
        setDisplayCount: (displayCount: number) => set({displayCount}),
        incrementDisplayCount: (increment: number) =>
          set({displayCount: get().displayCount + increment}),
        setFeedDisplayAs: (feedDisplayAs: "list" | "grid") => set({feedDisplayAs}),
        setEnabledFeedIds: (enabledFeedIds: string[]) => set({enabledFeedIds}),
        reorderFeeds: (startIndex: number, endIndex: number) => {
          const {enabledFeedIds} = get()
          const result = Array.from(enabledFeedIds)
          const [removed] = result.splice(startIndex, 1)
          result.splice(endIndex, 0, removed)
          set({enabledFeedIds: result})
        },
        toggleFeedEnabled: (feedId: string) => {
          const {enabledFeedIds} = get()
          const isEnabled = enabledFeedIds.includes(feedId)
          if (isEnabled) {
            set({enabledFeedIds: enabledFeedIds.filter((id) => id !== feedId)})
          } else {
            set({enabledFeedIds: [...enabledFeedIds, feedId]})
          }
        },
        deleteFeed: (feedId: string) => {
          const {enabledFeedIds, tabConfigs} = get()
          const newTabConfigs = {...tabConfigs}
          delete newTabConfigs[feedId]
          set({
            enabledFeedIds: enabledFeedIds.filter((id) => id !== feedId),
            tabConfigs: newTabConfigs,
          })
        },
        saveFeedConfig: (feedId: string, config: Partial<TabConfig>) => {
          const {tabConfigs} = get()
          const existingConfig = tabConfigs[feedId] || defaultTabConfigs[feedId] || {}
          set({
            tabConfigs: {
              ...tabConfigs,
              [feedId]: {...existingConfig, ...config},
            },
          })
        },
        loadFeedConfig: (feedId: string) => {
          const {tabConfigs} = get()
          return tabConfigs[feedId]
        },
        getAllFeedConfigs: () => {
          const {tabConfigs, enabledFeedIds} = get()
          return enabledFeedIds
            .map((id) => tabConfigs[id])
            .filter((config): config is TabConfig => config !== undefined)
        },
        resetAllFeedsToDefaults: () => {
          console.log("Resetting feeds to defaults")
          set({
            tabConfigs: {...defaultTabConfigs},
            enabledFeedIds: [
              "unseen",
              "popular",
              "latest",
              "market",
              "replies",
              "media",
              "adventure",
            ],
          })
        },
      }

      return {
        ...initialState,
        ...actions,
      }
    },
    {
      name: "feed-storage",
    }
  )
)

export const useActiveHomeTab = () => useFeedStore((state) => state.activeHomeTab)
export const useDisplayCount = () => useFeedStore((state) => state.displayCount)
export const useFeedDisplayAs = () => useFeedStore((state) => state.feedDisplayAs)
export const useEnabledFeedIds = () => useFeedStore((state) => state.enabledFeedIds)
export const useTabConfigs = () => useFeedStore((state) => state.tabConfigs)

// Export types
export type {TabConfig, TabFilter}
