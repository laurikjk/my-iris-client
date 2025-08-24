import {useSettingsStore} from "@/stores/settings"
import {SocialGraphUtils} from "nostr-social-graph/src/SocialGraphUtils"
import {LRUCache} from "typescript-lru-cache"
import socialGraph from "./socialGraph"

const cache = new LRUCache<string, boolean>({maxSize: 100})

export const clearVisibilityCache = () => {
  cache.clear()
}

export const shouldHideAuthor = (
  pubKey: string,
  threshold = 1,
  allowUnknown = false
): boolean => {
  const {content} = useSettingsStore.getState()
  const instance = socialGraph()

  // Check if the result is already in the cache
  const cacheKey = `${pubKey}-${threshold}-${allowUnknown}`
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

  // SocialGraphUtils.isOvermuted already checks if root user (current user) has muted
  if (SocialGraphUtils.isOvermuted(instance, pubKey, threshold)) {
    cache.set(cacheKey, true)
    return true
  }

  cache.set(cacheKey, false)
  return false
}

export const isOvermuted = (pubKey: string, threshold = 1): boolean => {
  const instance = socialGraph()
  // SocialGraphUtils.isOvermuted already checks if root user (current user) has muted
  return SocialGraphUtils.isOvermuted(instance, pubKey, threshold)
}

export const shouldHideEvent = (
  event: {
    pubkey: string
    tags: Array<Array<string>>
  },
  threshold = 1,
  allowUnknown = false
): boolean => {
  // Hide if author should be hidden
  if (shouldHideAuthor(event.pubkey, threshold, allowUnknown)) {
    return true
  }

  // Hide if event mentions any user that should be hidden
  const mentionedPubkeys = event.tags
    .filter((tag) => tag[0] === "p" && tag[1])
    .map((tag) => tag[1])

  return mentionedPubkeys.some((pubkey) =>
    // mentioned users can be unknown but not overmuted
    shouldHideAuthor(pubkey, threshold, true)
  )
}
