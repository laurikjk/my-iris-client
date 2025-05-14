import {useSettingsStore} from "@/stores/settings"
import socialGraph from "./socialGraph"

export const shouldHideAuthor = (pubKey: string, threshold = 1): boolean => {
  const {content} = useSettingsStore.getState()

  if (content.hideEventsByUnknownUsers && socialGraph().getFollowDistance(pubKey) >= 5) {
    return true
  }

  const followers = socialGraph().getFollowersByUser(pubKey).size
  const following = socialGraph().getFollowedByUser(pubKey).size

  if (followers === 0 || following === 0) {
    return false
  }

  const ratio = following / followers

  if (ratio > threshold) {
    return false
  }

  if (!content.hidePostsByMutedMoreThanFollowed) {
    return false
  }

  const mutedCount = socialGraph().getMutedByUser(pubKey).size
  const followedCount = socialGraph().getFollowedByUser(pubKey).size

  return mutedCount > followedCount
}
