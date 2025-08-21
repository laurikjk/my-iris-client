import {useSettingsStore} from "@/stores/settings"
import socialGraph from "@/utils/socialGraph"
import {shouldHideAuthor} from "@/utils/visibility"
import {getTag, getZappingUser, getZapAmount} from "@/utils/nostr.ts"
import {notifications, Notification as IrisNotification} from "@/utils/notifications"
import {SortedMap} from "@/utils/SortedMap/SortedMap"
import {useNotificationsStore} from "@/stores/notifications"
import debounce from "lodash/debounce"
import {ndk} from "@/utils/ndk"
import {NDKEvent, NDKSubscription} from "@nostr-dev-kit/ndk"
import {
  KIND_REACTION,
  KIND_REPOST,
  KIND_TEXT_NOTE,
  KIND_ZAP_RECEIPT,
  KIND_HIGHLIGHT,
  KIND_PICTURE_FIRST,
} from "@/utils/constants"

let sub: NDKSubscription | undefined

export const startNotificationsSubscription = debounce((myPubKey?: string) => {
  if (!myPubKey || typeof myPubKey !== "string") return

  sub?.stop()

  const kinds: number[] = [
    KIND_REACTION,
    KIND_REPOST,
    KIND_TEXT_NOTE, // replies
    KIND_ZAP_RECEIPT,
    KIND_HIGHLIGHT,
    KIND_PICTURE_FIRST, // when tagged
  ]

  const filters = {
    kinds: kinds,
    ["#p"]: [myPubKey],
    limit: 100,
  }

  sub = ndk().subscribe(filters)

  let latest = 0

  const settings = useSettingsStore.getState()
  const hideEventsByUnknownUsers = settings.content?.hideEventsByUnknownUsers

  sub.on("event", async (event: NDKEvent) => {
    if (event.kind !== KIND_ZAP_RECEIPT) {
      // allow zap notifs from self & unknown users
      if (event.pubkey === myPubKey) return
      if (hideEventsByUnknownUsers && socialGraph().getFollowDistance(event.pubkey) > 5)
        return
      // Skip notifications from authors that should be hidden
      if (shouldHideAuthor(event.pubkey)) return
    } else {
      // For zap notifications, check the zapping user
      const zappingUser = getZappingUser(event)
      if (zappingUser && shouldHideAuthor(zappingUser)) return
    }
    const eTag = getTag("e", event.tags)
    if (eTag && event.created_at) {
      const key = `${eTag}-${event.kind}`

      const notification =
        notifications.get(key) ||
        ({
          id: event.id,
          originalEventId: eTag,
          users: new SortedMap([], "time"),
          kind: event.kind,
          time: event.created_at,
          content: event.content,
          tags: event.tags,
        } as IrisNotification)
      const user = event.kind === KIND_ZAP_RECEIPT ? getZappingUser(event) : event.pubkey
      if (!user) {
        console.warn("no user for event", event)
        return
      }
      const existing = notification.users.get(user)
      if (!existing || existing.time < event.created_at) {
        let content: string | undefined = undefined
        if (event.kind === KIND_TEXT_NOTE) {
          // Text note (reply) content
          content = event.content
        } else if (event.kind === KIND_REACTION) {
          // Reaction content (emoji)
          content = event.content
        } else if (event.kind === KIND_ZAP_RECEIPT) {
          // Zap receipt - extract zap amount
          const zapAmount = await getZapAmount(event)
          content = zapAmount > 0 ? zapAmount.toString() : undefined
        } else if (event.kind === KIND_PICTURE_FIRST) {
          // Picture-first post content
          content = event.content
        }

        notification.users.set(user, {
          time: event.created_at,
          content,
        })
      }
      if (event.created_at > notification.time) {
        notification.time = event.created_at
        // Update notification content with the latest reply/reaction
        if (event.kind === KIND_TEXT_NOTE && event.content) {
          // For text notes (replies), update the notification content to show the latest reply
          notification.content = event.content
        } else if (event.kind === KIND_PICTURE_FIRST && event.content) {
          // For picture-first posts, update the notification content
          notification.content = event.content
        }
      }

      notifications.set(key, notification)

      if (event.created_at > latest) {
        latest = event.created_at
        useNotificationsStore.getState().setLatestNotification(event.created_at)
      }
    }
  })
}, 500)
