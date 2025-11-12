/// <reference lib="webworker" />
import {
  INVITE_EVENT_KIND,
  INVITE_RESPONSE_KIND,
  MESSAGE_EVENT_KIND,
  deserializeSessionState,
  Session,
  Rumor,
  deepCopyState,
} from "nostr-double-ratchet/src"
import type {SessionState} from "nostr-double-ratchet/src/types"
import {PROFILE_AVATAR_WIDTH, EVENT_AVATAR_WIDTH} from "./shared/components/user/const"
import {CacheFirst, StaleWhileRevalidate, NetworkOnly} from "workbox-strategies"
import {CacheableResponsePlugin} from "workbox-cacheable-response"
import {precacheAndRoute, PrecacheEntry} from "workbox-precaching"
import {generateProxyUrl} from "./shared/utils/imgproxy"
import {ExpirationPlugin} from "workbox-expiration"
import {registerRoute} from "workbox-routing"
import {clientsClaim} from "workbox-core"
import {VerifiedEvent} from "nostr-tools"
import localforage from "localforage"
import {KIND_CHANNEL_CREATE} from "./utils/constants"
import {LocalForageStorageAdapter} from "./session/StorageAdapter"

// eslint-disable-next-line no-undef
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[]
}

precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

// Prevent caching of graph-api.iris.to requests
registerRoute(({url}) => url.origin === "https://graph-api.iris.to", new NetworkOnly())

// Cache icons.svg for faster loading on mobile
registerRoute(
  ({url}) => url.pathname.endsWith("/icons.svg"),
  new StaleWhileRevalidate({
    cacheName: "icons-cache",
    plugins: [
      new ExpirationPlugin({maxEntries: 1, maxAgeSeconds: 7 * 24 * 60 * 60}), // 7 days
      new CacheableResponsePlugin({statuses: [0, 200]}),
    ],
  })
)

registerRoute(
  ({url}) => url.pathname.endsWith("/.well-known/nostr.json"),
  new StaleWhileRevalidate({
    cacheName: "nostr-json-cache",
    plugins: [new ExpirationPlugin({maxAgeSeconds: 4 * 60 * 60})],
  })
)

// Avatars
registerRoute(
  ({request, url}) => {
    return (
      request.destination === "image" &&
      url.href.startsWith("https://imgproxy.") &&
      (url.pathname.includes(
        `rs:fill:${PROFILE_AVATAR_WIDTH * 2}:${PROFILE_AVATAR_WIDTH * 2}`
      ) ||
        url.pathname.includes(
          `rs:fill:${EVENT_AVATAR_WIDTH * 2}:${EVENT_AVATAR_WIDTH * 2}`
        ))
    )
  },
  new CacheFirst({
    cacheName: "avatar-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100, // gif avatars can still be large
        matchOptions: {
          ignoreVary: true,
        },
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

// Cache images from any domain with size limit
registerRoute(
  // match images except gif
  ({request, url}) => request.destination === "image" && !url.pathname.endsWith(".gif"),
  new CacheFirst({
    cacheName: "image-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        matchOptions: {
          ignoreVary: true,
        },
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)

registerRoute(
  ({url}) =>
    url.origin === "https://nostr.api.v0l.io" &&
    url.pathname.startsWith("/api/v1/preview"),
  new CacheFirst({
    cacheName: "preview-cache",
    plugins: [
      new ExpirationPlugin({maxAgeSeconds: 24 * 60 * 60}),
      new CacheableResponsePlugin({statuses: [0, 200]}),
    ],
  })
)

registerRoute(
  ({url}) =>
    url.origin === "https://api.snort.social" &&
    url.pathname.startsWith("/api/v1/translate"),
  new CacheFirst({
    cacheName: "translate-cache",
    plugins: [
      new ExpirationPlugin({maxEntries: 1000}),
      new CacheableResponsePlugin({
        statuses: [0, 200, 204],
      }),
    ],
  })
)

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
self.addEventListener("install", (event) => {
  // delete all cache on install
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.debug("Deleting cache: ", cacheName)
          return caches.delete(cacheName)
        })
      )
    })
  )
})

interface PushData {
  event: {
    id: string
    pubkey: string
    created_at: number
    kind: number
    tags: string[][]
    content: string
    sig: string
  }
  title: string
  body: string
  icon: string
  url: string
}

self.addEventListener("notificationclick", (event) => {
  const notificationData = event.notification.data
  event.notification.close()
  console.debug("Notification clicked:", notificationData)

  event.waitUntil(
    (async function () {
      // Handle both direct URL and nested event data structure
      const path = notificationData?.url || notificationData?.event?.url
      if (!path) {
        console.debug("No URL in notification data")
        return
      }

      // If it's already a full URL, use URL constructor, otherwise just use the path
      const pathname = path.startsWith("http") ? new URL(path).pathname : path
      const fullUrl = `${self.location.origin}${pathname}`
      console.debug("Navigating to:", fullUrl)

      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      console.debug("Found clients:", allClients.length)

      if (allClients.length > 0) {
        // Try to find a visible client first, otherwise use the first one
        let client = allClients.find((c) => c.visibilityState === "visible")
        if (!client) {
          client = allClients[0]
        }

        try {
          await client.focus()
          console.debug("Client focused, sending navigation message")
          // Add a small delay to ensure focus completes before navigation
          await new Promise((resolve) => setTimeout(resolve, 100))
          await client.postMessage({
            type: "NAVIGATE_REACT_ROUTER",
            url: fullUrl,
          })
          console.debug("Navigation message sent successfully")
          return
        } catch (error) {
          console.error("Failed to focus client or send navigation message:", error)
          // Fall through to opening new window
        }
      }

      console.debug("No clients found or client communication failed, opening new window")
      if (self.clients.openWindow) {
        try {
          const newClient = await self.clients.openWindow(fullUrl)
          console.debug("New window opened successfully")
          return newClient
        } catch (error) {
          console.error("Failed to open new window:", error)
        }
      } else {
        console.error("openWindow not available")
      }
    })()
  )
})

const NOTIFICATION_CONFIGS: Record<
  number,
  {
    title: string
    url: string
    icon: string
  }
> = {
  [MESSAGE_EVENT_KIND]: {
    title: "New private message",
    url: "/chats",
    icon: "/favicon.png",
  },
  [INVITE_EVENT_KIND]: {
    title: "New message request",
    url: "/chats",
    icon: "/favicon.png",
  },
  [INVITE_RESPONSE_KIND]: {
    title: "New private message",
    url: "/chats",
    icon: "/favicon.png",
  },
} as const

type DecryptResult =
  | {
      success: false
    }
  | {
      success: true
      kind: number
      content: string
      sessionId: string
    }

type StoredDeviceRecord = {
  deviceId: string
  activeSession: string | null
  inactiveSessions: string[]
}

type StoredUserRecord = {
  publicKey: string
  devices?: StoredDeviceRecord[]
}

type SessionLookupEntry = {
  peerPubkey: string
  deviceId: string
  sessionState: SessionState
}

const USER_RECORD_PREFIX = "v1/user/"
let sessionStorageAdapter: LocalForageStorageAdapter | null = null

const getSessionStorage = () => {
  if (!sessionStorageAdapter) {
    sessionStorageAdapter = new LocalForageStorageAdapter()
  }
  return sessionStorageAdapter
}

const loadSessionsFromStorage = async (): Promise<SessionLookupEntry[]> => {
  const storage = getSessionStorage()
  try {
    const userKeys = await storage.list(USER_RECORD_PREFIX)
    if (!userKeys.length) return []

    const records = await Promise.all(
      userKeys.map(async (key) => {
        try {
          return await storage.get<StoredUserRecord>(key)
        } catch (error) {
          console.error("Failed to load stored user record:", key, error)
          return null
        }
      })
    )

    const entries: SessionLookupEntry[] = []

    for (const record of records) {
      if (!record?.devices?.length || !record.publicKey) continue

      for (const device of record.devices) {
        if (!device?.deviceId) continue
        const serializedStates = [
          ...(device.activeSession ? [device.activeSession] : []),
          ...(device.inactiveSessions || []),
        ]

        for (const serializedState of serializedStates) {
          if (!serializedState) continue
          try {
            const sessionState = deserializeSessionState(serializedState)
            entries.push({
              peerPubkey: record.publicKey,
              deviceId: device.deviceId,
              sessionState,
            })
          } catch (error) {
            console.error(
              "Failed to deserialize session state:",
              record.publicKey,
              device.deviceId,
              error
            )
          }
        }
      }
    }

    return entries
  } catch (error) {
    console.error("Failed to enumerate sessions from storage:", error)
    return []
  }
}

const buildSessionIndex = async () => {
  const entries = await loadSessionsFromStorage()
  const index = new Map<string, SessionLookupEntry>()

  for (const entry of entries) {
    const candidates = new Set<string>()
    if (entry.sessionState.theirCurrentNostrPublicKey) {
      candidates.add(entry.sessionState.theirCurrentNostrPublicKey)
    }
    if (entry.sessionState.theirNextNostrPublicKey) {
      candidates.add(entry.sessionState.theirNextNostrPublicKey)
    }

    const skippedKeys = entry.sessionState.skippedKeys || {}
    Object.keys(skippedKeys).forEach((pubkey) => {
      if (pubkey) {
        candidates.add(pubkey)
      }
    })

    candidates.forEach((pubkey) => index.set(pubkey, entry))
  }

  return index
}

const decryptWithState = async (
  state: SessionState,
  sessionId: string,
  data: PushData
): Promise<DecryptResult> => {
  const throwawayState = deepCopyState(state)
  const session = new Session((_, onEvent) => {
    onEvent(data.event as unknown as VerifiedEvent)
    return () => {}
  }, throwawayState)

  let unsubscribe: (() => void) | undefined
  const innerEvent = await new Promise<Rumor | null>((resolve) => {
    unsubscribe = session.onEvent((event) => {
      resolve(event)
    })
  })

  unsubscribe?.()

  console.warn("[SW] Throwaway session resolved", innerEvent !== null)
  if (innerEvent) {
    console.warn("[SW] Inner event kind", innerEvent.kind)
  }

  return innerEvent === null
    ? {
        success: false,
      }
    : {
        success: true,
        kind: innerEvent.kind,
        content: innerEvent.content,
        sessionId,
      }
}

const tryDecryptPrivateDM = async (data: PushData): Promise<DecryptResult> => {
  try {
    console.warn("[SW] Attempting session-manager decryption for push", data.event?.id)
    const sessionIndex = await buildSessionIndex()
    console.warn("[SW] Indexed sessions", sessionIndex.size)
    const matchedEntry = sessionIndex.get(data.event.pubkey)
    if (matchedEntry) {
      console.warn("[SW] Found matching session entry", matchedEntry.peerPubkey)
      const result = await decryptWithState(
        matchedEntry.sessionState,
        matchedEntry.peerPubkey,
        data
      )
      if (result.success) {
        console.warn("[SW] Decryption succeeded via session manager store")
        return result
      }
      console.warn("[SW] Decryption failed despite matching session entry")
    } else {
      console.warn("[SW] No matching session entry for pubkey", data.event.pubkey)
    }
  } catch (err) {
    console.error("DM decryption via session manager store failed:", err)
  }

  console.warn("[SW] No valid session state for push payload")
  return {success: false}
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      // // Check if we should show notification based on page visibility
      // const clients = await self.clients.matchAll({
      //   type: "window",
      //   includeUncontrolled: true,
      // })
      // const isPageVisible = clients.some((client) => client.visibilityState === "visible")
      // if (isPageVisible) {
      //   console.debug("Page is visible, ignoring web push")
      //   return
      // }

      const data = event.data?.json() as PushData | undefined
      if (!data?.event) return

      if (data.event.kind === MESSAGE_EVENT_KIND) {
        const result = await tryDecryptPrivateDM(data)
        if (result.success) {
          if (result.kind === KIND_CHANNEL_CREATE) {
            await self.registration.showNotification("New group invite", {
              icon: NOTIFICATION_CONFIGS[MESSAGE_EVENT_KIND].icon,
              data: {
                url: `/chats/${encodeURIComponent(result.sessionId)}`,
                event: data.event,
              },
            })
          } else {
            const decryptedTitle = result.content?.trim()
            await self.registration.showNotification(
              decryptedTitle && decryptedTitle.length
                ? decryptedTitle
                : NOTIFICATION_CONFIGS[MESSAGE_EVENT_KIND].title,
              {
                body: result.content,
                icon: NOTIFICATION_CONFIGS[MESSAGE_EVENT_KIND].icon,
                data: {
                  url: `/chats/${encodeURIComponent(result.sessionId)}`,
                  event: data.event,
                },
              }
            )
          }
          return
        }
      }

      if (NOTIFICATION_CONFIGS[data.event.kind]) {
        const config = NOTIFICATION_CONFIGS[data.event.kind]
        await self.registration.showNotification(config.title, {
          icon: config.icon,
          data: {url: config.url, event: data.event},
        })
        return
      }

      const imgproxySettings = (await localforage.getItem("imgproxy-settings")) as {
        url: string
        key: string
        salt: string
        enabled: boolean
        fallbackToOriginal: boolean
      } | null
      const proxyConfig = imgproxySettings
        ? {
            url: imgproxySettings.url,
            key: imgproxySettings.key,
            salt: imgproxySettings.salt,
          }
        : undefined

      const icon = data.icon?.startsWith("http")
        ? generateProxyUrl(data.icon, {width: 128, square: true}, proxyConfig)
        : data.icon || "/favicon.png"

      await self.registration.showNotification(data.title || "New notification", {
        body: data.body,
        icon,
        data,
      })
    })()
  )
})
