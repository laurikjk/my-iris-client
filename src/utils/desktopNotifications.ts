import {NDKFilter, NDKEvent, NDKSubscription} from "@nostr-dev-kit/ndk"
import {ndk} from "./ndk"
import {useUserStore} from "@/stores/user"
import {useNotificationsStore} from "@/stores/notifications"
import {useSettingsStore} from "@/stores/settings"
import {isTauri} from "./utils"
import {
  KIND_TEXT_NOTE,
  KIND_REPOST,
  KIND_REACTION,
  KIND_ZAP_RECEIPT,
} from "@/utils/constants"
import {sendNotification} from "@tauri-apps/plugin-notification"
import {MESSAGE_EVENT_KIND, INVITE_RESPONSE_KIND} from "nostr-double-ratchet/src"

let notificationSubscription: NDKSubscription | null = null
let dmNotificationSubscription: NDKSubscription | null = null

/**
 * Initialize desktop notifications by subscribing to NDK for relevant events
 * Only runs on desktop Tauri app
 */
export async function initDesktopNotifications() {
  if (!isTauri()) {
    console.log("Not running in Tauri, skipping desktop notifications")
    return
  }

  const myPubKey = useUserStore.getState().publicKey
  if (!myPubKey) {
    console.log("No user public key, skipping desktop notifications")
    return
  }

  // Check platform - only run on desktop (not mobile)
  try {
    const {platform} = await import("@tauri-apps/plugin-os")
    const platformType = await platform()
    if (platformType === "android" || platformType === "ios") {
      console.log("Running on mobile, skipping desktop notifications")
      return
    }
  } catch (e) {
    console.error("Failed to check platform:", e)
    return
  }

  console.log("Initializing desktop notifications via NDK")

  // Build notification filter based on user preferences
  const prefs = useSettingsStore.getState().notifications.preferences
  const kinds: number[] = []

  if (prefs.mentions || prefs.replies) {
    kinds.push(KIND_TEXT_NOTE)
  }
  if (prefs.reposts) {
    kinds.push(KIND_REPOST)
  }
  if (prefs.reactions) {
    kinds.push(KIND_REACTION)
  }
  if (prefs.zaps) {
    kinds.push(KIND_ZAP_RECEIPT)
  }

  if (kinds.length === 0) {
    console.log("No notification types enabled, skipping subscription")
    return
  }

  // Subscribe to mentions, replies, reactions, and zaps based on preferences
  const notificationFilter: NDKFilter = {
    "#p": [myPubKey],
    kinds,
  }

  const ndkInstance = ndk()

  // Unsubscribe from previous subscription if exists
  if (notificationSubscription) {
    notificationSubscription.stop()
  }

  notificationSubscription = ndkInstance.subscribe(notificationFilter, {
    closeOnEose: false,
  })

  notificationSubscription.on("event", async (event: NDKEvent) => {
    await handleNotificationEvent(event)
  })

  notificationSubscription.on("eose", () => {
    console.log("Desktop notifications subscription established")
  })

  // Subscribe to DM notifications
  await subscribeToDMNotifications()
}

/**
 * Subscribe to DM notifications
 */
async function subscribeToDMNotifications() {
  const myPubKey = useUserStore.getState().publicKey
  if (!myPubKey) return

  const prefs = useSettingsStore.getState().notifications.preferences
  if (!prefs.dms) {
    console.log("DM notifications disabled, skipping DM subscription")
    return
  }

  const ndkInstance = ndk()

  // Unsubscribe from previous subscription if exists
  if (dmNotificationSubscription) {
    dmNotificationSubscription.stop()
  }

  // TODO: Get session authors and invite recipients from stores when available
  const sessionAuthors: string[] = []
  const inviteRecipients: string[] = []

  if (sessionAuthors.length === 0 && inviteRecipients.length === 0) {
    return // Nothing to subscribe to yet
  }

  const filters: NDKFilter[] = []

  if (sessionAuthors.length > 0) {
    filters.push({
      kinds: [MESSAGE_EVENT_KIND as number],
      authors: sessionAuthors,
    })
  }

  if (inviteRecipients.length > 0) {
    filters.push({
      kinds: [INVITE_RESPONSE_KIND as number],
      "#p": inviteRecipients,
    })
  }

  dmNotificationSubscription = ndkInstance.subscribe(filters, {
    closeOnEose: false,
  })

  dmNotificationSubscription.on("event", async (event: NDKEvent) => {
    await handleDMNotificationEvent(event)
  })

  dmNotificationSubscription.on("eose", () => {
    console.log("Desktop DM notifications subscription established")
  })
}

/**
 * Handle incoming notification event from NDK
 */
async function handleNotificationEvent(event: NDKEvent) {
  const myPubKey = useUserStore.getState().publicKey
  if (!myPubKey || event.pubkey === myPubKey) {
    return // Don't notify on own events
  }

  // Check if we've already seen this notification
  const lastNotification = useNotificationsStore.getState().latestNotification
  if (event.created_at && event.created_at * 1000 <= lastNotification) {
    return // Already seen
  }

  // Update latest notification timestamp
  if (event.created_at) {
    useNotificationsStore.getState().setLatestNotification(event.created_at * 1000)
  }

  // Check user preferences
  const prefs = useSettingsStore.getState().notifications.preferences

  // Get author info
  const author = event.author
  await author.fetchProfile()
  const authorName = author.profile?.displayName || author.profile?.name || "Someone"

  let title = ""
  let body = ""

  switch (event.kind) {
    case KIND_TEXT_NOTE: {
      // Check if it's a reply or mention
      const mentionedPubkeys = event.getMatchingTags("p").map((tag) => tag[1])
      const isReply = event.getMatchingTags("e").length > 0

      if (isReply) {
        if (!prefs.replies) return
        title = `${authorName} replied to you`
      } else if (mentionedPubkeys.includes(myPubKey)) {
        if (!prefs.mentions) return
        title = `${authorName} mentioned you`
      } else {
        if (!prefs.mentions) return
        title = `New post from ${authorName}`
      }
      body = event.content.slice(0, 100)
      break
    }
    case KIND_REPOST:
      if (!prefs.reposts) return
      title = `${authorName} reposted you`
      body = event.content || "Your post was reposted"
      break
    case KIND_REACTION:
      if (!prefs.reactions) return
      title = `${authorName} reacted to your post`
      body = event.content || "❤️"
      break
    case KIND_ZAP_RECEIPT: {
      if (!prefs.zaps) return
      // Extract zap amount if available
      const description = event.getMatchingTags("description")[0]?.[1]
      let zapAmount = ""
      if (description) {
        try {
          const zapRequest = JSON.parse(description)
          const amount = zapRequest.tags?.find((t: string[]) => t[0] === "amount")?.[1]
          if (amount) {
            zapAmount = ` (${Math.floor(parseInt(amount) / 1000)} sats)`
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      title = `${authorName} zapped you${zapAmount}`
      body = "You received a zap!"
      break
    }
  }

  // Show notification
  try {
    await sendNotification({
      title,
      body,
    })
  } catch (error) {
    console.error("Failed to send desktop notification:", error)
  }
}

/**
 * Handle incoming DM notification event from NDK
 */
async function handleDMNotificationEvent(event: NDKEvent) {
  const myPubKey = useUserStore.getState().publicKey
  if (!myPubKey || event.pubkey === myPubKey) {
    return // Don't notify on own messages
  }

  // Get author info
  const author = event.author
  await author.fetchProfile()
  const authorName = author.profile?.displayName || author.profile?.name || "Someone"

  let title = ""
  let body = ""

  switch (event.kind) {
    case MESSAGE_EVENT_KIND:
      title = `New message from ${authorName}`
      body = "You have a new encrypted message"
      break
    case INVITE_RESPONSE_KIND:
      title = `Chat invite from ${authorName}`
      body = "You received a new chat invitation"
      break
  }

  // Show notification
  try {
    await sendNotification({
      title,
      body,
    })
  } catch (error) {
    console.error("Failed to send desktop DM notification:", error)
  }
}

/**
 * Stop desktop notification subscriptions
 */
export function stopDesktopNotifications() {
  if (notificationSubscription) {
    notificationSubscription.stop()
    notificationSubscription = null
  }
  if (dmNotificationSubscription) {
    dmNotificationSubscription.stop()
    dmNotificationSubscription = null
  }
  console.log("Desktop notifications stopped")
}
