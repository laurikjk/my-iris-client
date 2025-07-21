import {NDKEvent} from "@nostr-dev-kit/ndk"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {shouldHideAuthor} from "@/utils/visibility"
import socialGraph from "@/utils/socialGraph"

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
      socialGraph().getFollowDistance(event.pubkey) >= 5 &&
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
      socialGraph().getFollowDistance(event.pubkey) >= 5 &&
      !(filterAuthors && filterAuthors.includes(event.pubkey)) &&
      !shouldHideAuthor(event.pubkey, undefined, true)
  )
}