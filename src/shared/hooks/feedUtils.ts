import {NDKEvent} from "@nostr-dev-kit/ndk"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {shouldHideAuthor} from "@/utils/visibility"
import socialGraph from "@/utils/socialGraph"

// Constants
export const FETCH_BUFFER_SIZE = 20
export const MIN_FOLLOW_DISTANCE = 5

// Type guards
export const isReactionEvent = (event: NDKEvent): boolean => {
  return event.kind === 6 || event.kind === 7
}

export const isPostEvent = (event: NDKEvent): boolean => {
  return event.kind === 1
}

export const eventComparator = ([, a]: [string, NDKEvent], [, b]: [string, NDKEvent]) => {
  if (b.created_at && a.created_at) return b.created_at - a.created_at
  return 0
}

export const createEventFilter = (
  displayFilterFn: ((event: NDKEvent) => boolean) | undefined,
  localFilterAuthors: string[] | undefined,
  hideEventsByUnknownUsers: boolean,
  filterAuthors: string[] | undefined
) => {
  return (event: NDKEvent) => {
    if (!event.created_at) return false
    if (displayFilterFn && !displayFilterFn(event)) return false
    const inAuthors = localFilterAuthors?.includes(event.pubkey)
    if (!inAuthors && shouldHideAuthor(event.pubkey, 3)) {
      return false
    }
    if (
      hideEventsByUnknownUsers &&
      socialGraph().getFollowDistance(event.pubkey) >= MIN_FOLLOW_DISTANCE &&
      !(filterAuthors && filterAuthors.includes(event.pubkey))
    ) {
      return false
    }
    return true
  }
}

export const getEventsByUnknownUsers = (
  events: SortedMap<string, NDKEvent>,
  displayFilterFn: ((event: NDKEvent) => boolean) | undefined,
  hideEventsByUnknownUsers: boolean,
  filterAuthors: string[] | undefined
) => {
  if (!hideEventsByUnknownUsers) {
    return []
  }
  return Array.from(events.values()).filter(
    (event) =>
      (!displayFilterFn || displayFilterFn(event)) &&
      socialGraph().getFollowDistance(event.pubkey) >= MIN_FOLLOW_DISTANCE &&
      !(filterAuthors && filterAuthors.includes(event.pubkey)) &&
      !shouldHideAuthor(event.pubkey, undefined, true)
  )
}

// Popular feed specific utilities
export const calculateLikesByPostId = (
  reactions: Iterable<NDKEvent>
): Map<string, number> => {
  const likesByPostId = new Map<string, number>()

  for (const reaction of reactions) {
    if (!reaction.tags) continue
    const postId = reaction.tags.find((t) => t[0] === "e")?.[1]
    if (postId) {
      likesByPostId.set(postId, (likesByPostId.get(postId) || 0) + 1)
    }
  }

  return likesByPostId
}

export const sortPostsByPopularity = (likesByPostId: Map<string, number>): string[] => {
  return Array.from(likesByPostId.entries())
    .sort(([, likesA], [, likesB]) => likesB - likesA)
    .map(([postId]) => postId)
}

export interface PostCollectionResult {
  posts: NDKEvent[]
  missingPostIds: string[]
}

export const collectPostsWithLimit = (
  sortedPostIds: string[],
  postsMap: Map<string, NDKEvent>,
  filterFn: (event: NDKEvent) => boolean,
  fetchedIds: Set<string>,
  limit: number
): PostCollectionResult => {
  const posts: NDKEvent[] = []
  const missingPostIds: string[] = []
  const neededLimit = limit + FETCH_BUFFER_SIZE

  for (const postId of sortedPostIds) {
    // Check if we've collected enough
    if (posts.length + missingPostIds.length >= neededLimit) {
      break
    }

    const post = postsMap.get(postId)
    if (post && filterFn(post)) {
      posts.push(post)
    } else if (!fetchedIds.has(postId)) {
      missingPostIds.push(postId)
    }
  }

  return {posts, missingPostIds}
}
