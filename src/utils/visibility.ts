import {useSettingsStore} from "@/stores/settings"
import {SocialGraphUtils} from "nostr-social-graph/src/SocialGraphUtils"
import {LRUCache} from "typescript-lru-cache"
import socialGraph from "./socialGraph"

const cache = new LRUCache<string, boolean>({maxSize: 100})

export const shouldHideAuthor = (
  pubKey: string,
  threshold = 1,
  allowUnknown = false
): boolean => {
  const {content} = useSettingsStore.getState()
  const instance = socialGraph()

  // Check if the result is already in the cache
  const cacheKey = `${pubKey}-${threshold}`
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }

  // Check hideEventsByUnknownUsers setting only if allowUnknown is false
  // When allowUnknown is true, the feed-specific setting should override the global setting
  if (
    !allowUnknown &&
    content.hideEventsByUnknownUsers &&
    instance.getFollowDistance(pubKey) >= 10
  ) {
    cache.set(cacheKey, true)
    return true
  }

  if (SocialGraphUtils.isOvermuted(instance, pubKey, threshold)) {
    cache.set(cacheKey, true)
    return true
  }

  cache.set(cacheKey, false)
  return false
}
