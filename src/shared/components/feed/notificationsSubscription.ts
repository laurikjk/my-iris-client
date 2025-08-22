import {useSettingsStore} from "@/stores/settings"
import {useUserStore} from "@/stores/user"
import socialGraph, {socialGraphEvents} from "@/utils/socialGraph"
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

// Clean up notifications from muted users
const cleanupMutedNotifications = () => {
  const toRemove: string[] = []
  let totalUsersRemoved = 0
  const myPubKey = useUserStore.getState().publicKey

  for (const [key, notification] of notifications) {
    // Check if notification mentions any muted users in p tags
    if (notification.tags) {
      const hasMutedMention = notification.tags.some(
        (tag) =>
          tag[0] === "p" && tag[1] && tag[1] !== myPubKey && shouldHideAuthor(tag[1])
      )

      if (hasMutedMention) {
        toRemove.push(key)
        continue // Skip to next notification
      }
    }

    // Check each user in the notification
    const usersToRemove: string[] = []
    for (const [userPubKey] of notification.users) {
      if (shouldHideAuthor(userPubKey)) {
        usersToRemove.push(userPubKey)
      }
    }

    // Remove muted users from this notification
    usersToRemove.forEach((user) => {
      notification.users.delete(user)
    })
    totalUsersRemoved += usersToRemove.length

    // If no users left, mark notification for removal
    if (notification.users.size === 0) {
      toRemove.push(key)
    }
  }

  // Remove empty notifications
  toRemove.forEach((key) => {
    notifications.delete(key)
  })

  if (toRemove.length > 0 || totalUsersRemoved > 0) {
    console.log(
      `Cleaned up ${toRemove.length} notifications and ${totalUsersRemoved} users after mute list update`
    )
  }
}

export const startNotificationsSubscription = debounce((myPubKey?: string) => {
  if (!myPubKey || typeof myPubKey !== "string") return

  sub?.stop()

  // Listen for mute list updates and clean up notifications
  const handleMuteListUpdate = () => {
    cleanupMutedNotifications()
  }

  // Remove old listener if exists and add new one
  socialGraphEvents.removeListener("muteListUpdated", handleMuteListUpdate)
  socialGraphEvents.on("muteListUpdated", handleMuteListUpdate)

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
      // Skip notifications from authors that should be hidden (includes muted users)
      if (shouldHideAuthor(event.pubkey)) return

      // Skip notifications from events that mention muted users
      const hasMutedMention = event.tags.some(
        (tag) =>
          tag[0] === "p" && tag[1] && tag[1] !== myPubKey && shouldHideAuthor(tag[1])
      )

      if (hasMutedMention) return
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
          // For text notes (replies), update the notification content and ID to show the latest reply
          notification.content = event.content
          notification.id = event.id
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
