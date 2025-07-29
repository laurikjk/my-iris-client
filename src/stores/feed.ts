import {persist} from "zustand/middleware"
import {create} from "zustand"

interface FeedFilter {
  kinds?: number[]
  since?: number
  limit?: number
  search?: string
  "#e"?: string[]
}

interface FeedConfig {
  name: string
  id: string
  customName?: string
  showRepliedTo?: boolean
  hideReplies?: boolean
  filter?: FeedFilter
  sortLikedPosts?: boolean
  // Store filter criteria as serializable data
  followDistance?: number
  requiresMedia?: boolean
  requiresReplies?: boolean
  excludeSeen?: boolean
  showEventsByUnknownUsers?: boolean
  relayUrls?: string[]
  feedType?: "chronological" | "popular"
  // For reply feeds - only show replies to this specific event
  repliesTo?: string
  // Sort type for events
  sortType?: "chronological" | "followDistance" | "liked"
}

interface FeedState {
  activeFeed: string
  displayCount: number
  feedDisplayAs: "list" | "grid"
  enabledFeedIds: string[]
  feedConfigs: Record<string, FeedConfig>

  setActiveFeed: (feedId: string) => void
  setDisplayCount: (count: number) => void
  incrementDisplayCount: (increment: number) => void
  setFeedDisplayAs: (displayAs: "list" | "grid") => void
  setEnabledFeedIds: (feedIds: string[]) => void
  reorderFeeds: (startIndex: number, endIndex: number) => void
  toggleFeedEnabled: (feedId: string) => void
  deleteFeed: (feedId: string) => void
  saveFeedConfig: (feedId: string, config: Partial<FeedConfig>) => void
  loadFeedConfig: (feedId: string) => FeedConfig | undefined
  getAllFeedConfigs: () => FeedConfig[]
  resetAllFeedsToDefaults: () => void
}

const defaultFeedConfigs: Record<string, FeedConfig> = {
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
    feedType: "popular",
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
        activeFeed: "unseen",
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
        feedConfigs: defaultFeedConfigs,
      }

      const actions = {
        setActiveFeed: (activeFeed: string) => set({activeFeed}),
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
          const {enabledFeedIds, feedConfigs} = get()
          const newFeedConfigs = {...feedConfigs}
          delete newFeedConfigs[feedId]
          set({
            enabledFeedIds: enabledFeedIds.filter((id) => id !== feedId),
            feedConfigs: newFeedConfigs,
          })
        },
        saveFeedConfig: (feedId: string, config: Partial<FeedConfig>) => {
          const {feedConfigs} = get()
          const existingConfig = feedConfigs[feedId] || defaultFeedConfigs[feedId] || {}
          set({
            feedConfigs: {
              ...feedConfigs,
              [feedId]: {...existingConfig, ...config},
            },
          })
        },
        loadFeedConfig: (feedId: string) => {
          const {feedConfigs} = get()
          return feedConfigs[feedId]
        },
        getAllFeedConfigs: () => {
          const {feedConfigs, enabledFeedIds} = get()
          return enabledFeedIds
            .map((id) => feedConfigs[id])
            .filter((config): config is FeedConfig => config !== undefined)
        },
        resetAllFeedsToDefaults: () => {
          console.log("Resetting feeds to defaults")
          set({
            feedConfigs: {...defaultFeedConfigs},
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
      migrate: (persistedState: unknown) => {
        // Type guard to check if persistedState is an object with expected properties
        const state = persistedState as Record<string, unknown>

        // Handle migration from old activeHomeTab to activeFeed
        if (
          state &&
          typeof state === "object" &&
          state.activeHomeTab &&
          !state.activeFeed
        ) {
          state.activeFeed = state.activeHomeTab
        }
        // Handle migration from old tabConfigs to feedConfigs
        if (
          state &&
          typeof state === "object" &&
          state.tabConfigs &&
          !state.feedConfigs
        ) {
          state.feedConfigs = state.tabConfigs
        }
        return state
      },
    }
  )
)

export const useActiveFeed = () => useFeedStore((state) => state.activeFeed)
export const useDisplayCount = () => useFeedStore((state) => state.displayCount)
export const useFeedDisplayAs = () => useFeedStore((state) => state.feedDisplayAs)
export const useEnabledFeedIds = () => useFeedStore((state) => state.enabledFeedIds)
export const useFeedConfigs = () => useFeedStore((state) => state.feedConfigs)

// Export types
export type {FeedConfig, FeedFilter}
