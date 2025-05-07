import {LRUCache} from "typescript-lru-cache"
import socialGraph from "./socialGraph"

let hideEventsByUnknownUsers = true
let hidePostsByMutedMoreThanFollowed = true

const cache = new LRUCache<string, boolean>({maxSize: 100})

export const shouldHideAuthor = (pubKey: string, threshold = 1): boolean => {
  if (hideEventsByUnknownUsers && socialGraph().getFollowDistance(pubKey) >= 5) {
    return true
  }

  const root = socialGraph().getRoot()
  if (socialGraph().getMutedByUser(root).has(pubKey)) {
    return true
  }

  if (!hidePostsByMutedMoreThanFollowed) {
    return false
  }

  // Check if the result is already in the cache
  if (cache.has(pubKey)) {
    return cache.get(pubKey)!
  }

  const hasMuters = socialGraph().getUserMutedBy(pubKey).size > 0

  // for faster checks, if no one mutes, return false
  if (!hasMuters) {
    cache.set(pubKey, false)
    return false
  }

  const userStats = socialGraph().stats(pubKey)

  // Sort numeric distances ascending
  const distances = Object.keys(userStats)
    .map(Number)
    .sort((a, b) => a - b)

  // Look at the smallest distance that has any followers/muters
  for (const distance of distances) {
    const {followers, muters} = userStats[distance]
    if (followers + muters === 0) {
      continue // No one at this distance has an opinion; skip
    }

    // If, at the closest distance with an opinion, muters >= followers => hide
    const shouldHide = muters * threshold >= followers
    cache.set(pubKey, shouldHide)
    return shouldHide
  }

  // If no one anywhere follows or mutes, default to hide
  cache.set(pubKey, true)
  return true
}

export const setHideEventsByUnknownUsers = (value: boolean) => {
  hideEventsByUnknownUsers = value
}

export const setHidePostsByMutedMoreThanFollowed = (value: boolean) => {
  hidePostsByMutedMoreThanFollowed = value
}
