import {INVITE_EVENT_KIND, MESSAGE_EVENT_KIND} from "nostr-double-ratchet/src"
import {NDKTag, NDKEvent, NDKUser} from "@nostr-dev-kit/ndk"
import {getSessions} from "@/pages/messages/Sessions"
import {getZapAmount, getZappingUser} from "./nostr"
import {getInvites} from "@/pages/messages/Invites"
import {SortedMap} from "./SortedMap/SortedMap"
import socialGraph from "@/utils/socialGraph"
import {profileCache} from "@/utils/memcache"
import debounce from "lodash/debounce"
import {base64} from "@scure/base"
import IrisAPI from "./IrisAPI"

interface ReactedTime {
  time: number
}

export interface Notification {
  id: string
  originalEventId: string
  users: SortedMap<string, ReactedTime>
  kind: number
  time: number
  content: string
  tags?: NDKTag[]
}

export const notifications = new SortedMap<string, Notification>([], "time")

// Define the NotificationOptions interface locally
interface NotificationOptions {
  body?: string
  icon?: string
  image?: string
  badge?: string
  tag?: string
  data?: unknown
  vibrate?: number[]
  renotify?: boolean
  silent?: boolean
  requireInteraction?: boolean
  actions?: NotificationAction[]
  dir?: "auto" | "ltr" | "rtl"
  lang?: string
  timestamp?: number
  noscreen?: boolean
  sound?: string
}

// Define the NotificationAction interface locally
interface NotificationAction {
  action: string
  title: string
  icon?: string
}

export const showNotification = (
  title: string,
  options?: NotificationOptions,
  nag = false
) => {
  if ("serviceWorker" in navigator && window.Notification?.permission === "granted") {
    navigator.serviceWorker.ready.then(async function (serviceWorker) {
      await serviceWorker.showNotification(title, options)
    })
  } else if (nag) {
    alert("Notifications are not allowed. Please enable them first.")
  }
}

const openedAt = Math.floor(Date.now() / 1000)

export async function maybeShowPushNotification(event: NDKEvent) {
  if (event.kind !== 9735 || event.created_at! < openedAt) {
    return
  }

  const user = getZappingUser(event)
  const amount = await getZapAmount(event)
  let profile = profileCache.get(user)

  if (!profile) {
    const fetchProfileWithTimeout = (user: string) => {
      return Promise.race([
        new NDKUser({pubkey: user}).fetchProfile(),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1000)),
      ])
    }

    const p = await fetchProfileWithTimeout(user)
    if (p?.name) {
      profile = p
    }
  }

  const name = profile?.name || profile?.username || "Someone"

  showNotification(`${name} zapped you ${amount} sats!`, {
    icon: "/favicon.png",
    image: "/img/zap.png",
    requireInteraction: false,
    data: {url: "/notifications"},
  })
}

export const subscribeToDMNotifications = debounce(async () => {
  const reg = await navigator.serviceWorker.ready
  const pushSubscription = await reg.pushManager.getSubscription()

  if (!pushSubscription) {
    console.log("No push subscription available")
    return
  }

  const inviteRecipients = Array.from(getInvites().values())
    .map((i) => i.inviterEphemeralPublicKey)
    .filter((a) => typeof a === "string") as string[]

  const sessionAuthors = Array.from(getSessions().values())
    .flatMap((s) => [
      s?.state.theirCurrentNostrPublicKey,
      s?.state.theirNextNostrPublicKey,
    ])
    .filter((a) => typeof a === "string") as string[]

  console.log("inviteRecipients", ...inviteRecipients)
  console.log("sessionAuthors", ...sessionAuthors)

  const webPushData = {
    endpoint: pushSubscription.endpoint,
    p256dh: base64.encode(new Uint8Array(pushSubscription.getKey("p256dh")!)),
    auth: base64.encode(new Uint8Array(pushSubscription.getKey("auth")!)),
  }

  const api = new IrisAPI()
  const currentSubscriptions = await api.getSubscriptions()

  // Create/update subscription for session authors
  if (sessionAuthors.length > 0) {
    const sessionSub = Object.entries(currentSubscriptions).find(
      ([, sub]) =>
        sub.filter.kinds?.length === 1 &&
        sub.filter.kinds[0] === MESSAGE_EVENT_KIND &&
        sub.filter.authors && // Look for subscription with authors filter
        (sub.web_push_subscriptions || []).some(
          (sub) => sub.endpoint === webPushData.endpoint
        )
    )

    if (sessionSub) {
      const [id, sub] = sessionSub
      const existingAuthors = sub.filter.authors || []
      if (!arrayEqual(existingAuthors, sessionAuthors)) {
        await api.updateSubscription(id, {
          filter: {
            kinds: [MESSAGE_EVENT_KIND],
            authors: sessionAuthors,
          },
          web_push_subscriptions: [webPushData],
          webhooks: [],
          subscriber: sub.subscriber,
        })
      }
    } else {
      await api.registerPushNotifications([webPushData], {
        kinds: [MESSAGE_EVENT_KIND],
        authors: sessionAuthors,
      })
    }
  }

  // Create/update subscription for invite authors
  if (inviteRecipients.length > 0) {
    const inviteSub = Object.entries(currentSubscriptions).find(
      ([, sub]) =>
        sub.filter.kinds?.length === 1 &&
        sub.filter.kinds[0] === INVITE_EVENT_KIND &&
        sub.filter["#p"] && // Look for subscription with #p tags
        !sub.filter.authors && // but no authors filter
        (sub.web_push_subscriptions || []).some(
          (sub) => sub.endpoint === webPushData.endpoint
        )
    )

    if (inviteSub) {
      const [id, sub] = inviteSub
      const existinginviteRecipients = sub.filter["#p"] || []
      if (!arrayEqual(existinginviteRecipients, inviteRecipients)) {
        await api.updateSubscription(id, {
          filter: {
            kinds: [INVITE_EVENT_KIND],
            "#p": inviteRecipients,
          },
          web_push_subscriptions: [webPushData],
          webhooks: [],
          subscriber: sub.subscriber,
        })
      }
    } else {
      await api.registerPushNotifications([webPushData], {
        kinds: [INVITE_EVENT_KIND],
        "#p": inviteRecipients,
      })
    }
  }
}, 5000)

// Helper function to compare arrays
function arrayEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((val, idx) => b[idx] === val)
}

export async function subscribeToNotifications() {
  if (!CONFIG.features.pushNotifications) {
    return
  }

  // request permissions to send notifications
  if ("Notification" in window) {
    try {
      if (Notification.permission !== "granted") {
        await Notification.requestPermission()
      }
    } catch (e) {
      console.error(e)
    }
  }
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready
      if (reg) {
        const api = new IrisAPI()
        const {vapid_public_key: newVapidKey} = await api.getPushNotificationInfo()

        // Check for existing subscription
        const existingSub = await reg.pushManager.getSubscription()
        if (existingSub) {
          const existingKey = new Uint8Array(existingSub.options.applicationServerKey!)
          const newKey = new Uint8Array(Buffer.from(newVapidKey, "base64"))

          // Only subscribe if the keys are different
          if (
            existingKey.length === newKey.length &&
            existingKey.every((byte, i) => byte === newKey[i])
          ) {
            return // Already subscribed with the same key
          }

          await existingSub.unsubscribe()
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: newVapidKey,
        })

        const myKey = [...socialGraph().getUsersByFollowDistance(0)][0]
        const filter = {
          "#p": [myKey],
          kinds: [1, 6, 7],
        }
        await api.registerPushNotifications(
          [
            {
              endpoint: sub.endpoint,
              p256dh: base64.encode(new Uint8Array(sub.getKey("p256dh")!)),
              auth: base64.encode(new Uint8Array(sub.getKey("auth")!)),
            },
          ],
          filter
        )
      }
    }
  } catch (e) {
    console.error(e)
  }
}

export const clearNotifications = async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      const notifications = await registration.getNotifications()
      notifications.forEach((notification) => notification.close())
    }
  }
}

export const unsubscribeAll = async () => {
  if (!("serviceWorker" in navigator)) {
    return
  }

  const reg = await navigator.serviceWorker.ready
  const pushSubscription = await reg.pushManager.getSubscription()

  if (!pushSubscription) {
    return
  }

  const api = new IrisAPI()
  const currentSubscriptions = await api.getSubscriptions()

  // Delete all matching subscriptions simultaneously
  const deletePromises = Object.entries(currentSubscriptions)
    .filter(([, sub]) =>
      (sub.web_push_subscriptions || []).some(
        (s) => s.endpoint === pushSubscription.endpoint
      )
    )
    .map(([id]) => api.deleteSubscription(id))

  await Promise.all(deletePromises)

  // Unsubscribe from push notifications at the browser level
  await pushSubscription.unsubscribe()
}
