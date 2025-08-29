export type FeedType = "popular" | "for-you"

export interface FeedFilter {
  kinds?: number[]
  since?: number
  limit?: number
  search?: string
  "#e"?: string[]
  "#g"?: string[]
  "#t"?: string[]
}

export interface FeedConfig {
  name: string
  id: string
  customName?: string
  showRepliedTo?: boolean
  hideReplies?: boolean
  filter?: FeedFilter
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
