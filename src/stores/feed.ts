import {persist} from "zustand/middleware"
import {create} from "zustand"
import {
  KIND_TEXT_NOTE,
  KIND_REPOST,
  KIND_CLASSIFIED,
  KIND_LONG_FORM_CONTENT,
} from "@/utils/constants"

export type FeedType = "popular" | "for-you"

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
  // Store filter criteria as serializable data
  followDistance?: number // undefined = no follow distance filtering, number = max degrees
  requiresMedia?: boolean
  requiresReplies?: boolean
  excludeSeen?: boolean
  showEventsByUnknownUsers?: boolean // Deprecated in feed configs, used only in global settings
  relayUrls?: string[]
  // For reply feeds - only show replies to this specific event
  repliesTo?: string
  // Sort type for events
  sortType?: "chronological" | "followDistance" | "liked"
  // Show new events automatically without the dialog
  autoShowNewEvents?: boolean
  // Display mode for this specific feed
  displayAs?: "list" | "grid"
  // Feed strategy for popular feeds
  feedStrategy?: FeedType
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
  cloneFeed: (feedId: string) => string
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
      kinds: [KIND_TEXT_NOTE, KIND_REPOST, KIND_LONG_FORM_CONTENT],
      limit: 100,
    },
    followDistance: 1,
  },
  popular: {
    name: "Popular",
    id: "popular",
    feedStrategy: "popular",
  },
  latest: {
    name: "Latest",
    id: "latest",
    showRepliedTo: true,
    followDistance: 1,
    hideReplies: false,
    filter: {
      kinds: [KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT],
      limit: 100,
    },
  },
  articles: {
    name: "Articles",
    id: "articles",
    showRepliedTo: false,
    followDistance: 2,
    hideReplies: true,
    filter: {
      kinds: [KIND_LONG_FORM_CONTENT],
      limit: 100,
    },
  },
  market: {
    name: "Market",
    id: "market",
    showRepliedTo: false,
    filter: {
      kinds: [KIND_CLASSIFIED],
      limit: 100,
    },
    followDistance: 3,
    hideReplies: true,
  },
  media: {
    name: "Media",
    id: "media",
    showRepliedTo: false,
    requiresMedia: true,
    hideReplies: true,
    followDistance: 1,
    filter: {
      kinds: [KIND_TEXT_NOTE],
      limit: 100,
    },
  },
  adventure: {
    name: "Adventure",
    id: "adventure",
    showRepliedTo: false,
    filter: {
      kinds: [KIND_TEXT_NOTE, KIND_LONG_FORM_CONTENT],
      limit: 100,
    },
    followDistance: 5,
    hideReplies: true,
  },
  "for-you": {
    name: "For You",
    id: "for-you",
    feedStrategy: "for-you",
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
          "for-you",
          "articles",
          "latest",
          "market",
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
        cloneFeed: (feedId: string) => {
          const {feedConfigs, enabledFeedIds} = get()
          const originalConfig = feedConfigs[feedId]
          if (!originalConfig) return feedId

          // Generate unique ID for the cloned feed
          const timestamp = Date.now()
          const newFeedId = `${feedId}_clone_${timestamp}`

          // Get display name for the original feed
          const originalName = originalConfig.customName || originalConfig.name

          // Create cloned config with new ID and name
          const clonedConfig: FeedConfig = {
            ...originalConfig,
            id: newFeedId,
            customName: `Copy of ${originalName}`,
          }

          // Insert cloned feed right after the original feed in the enabled feeds list
          const originalIndex = enabledFeedIds.findIndex((id) => id === feedId)
          const newEnabledFeedIds = [...enabledFeedIds]
          newEnabledFeedIds.splice(originalIndex + 1, 0, newFeedId)

          // Add to configs and enabled feeds list
          set({
            feedConfigs: {
              ...feedConfigs,
              [newFeedId]: clonedConfig,
            },
            enabledFeedIds: newEnabledFeedIds,
            activeFeed: newFeedId, // Switch to the cloned feed
          })

          return newFeedId
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
              "for-you",
              "latest",
              "market",
              "articles",
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

export const useEnabledFeedIds = () => useFeedStore((state) => state.enabledFeedIds)
export const useFeedConfigs = () => useFeedStore((state) => state.feedConfigs)

// Utility function to generate cache key for feed configs
// Excludes display-only properties that shouldn't invalidate cache
export const getFeedCacheKey = (feedConfig: FeedConfig): string => {
  // Create a copy without display-only properties
  // Note: displayAs affects content filtering (grid mode filters media-only), so it's included
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {name, customName, ...cacheableConfig} = feedConfig
  return JSON.stringify(cacheableConfig)
}

// Export types
export type {FeedConfig, FeedFilter}
