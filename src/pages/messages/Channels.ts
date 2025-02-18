import {Channel, deserializeChannelState} from "nostr-double-ratchet"
import {Filter, VerifiedEvent} from "nostr-tools"
import {showNotification} from "@/utils/notifications"
import {profileCache} from "@/utils/memcache"
import AnimalName from "@/utils/AnimalName"
import {MessageType} from "./Message"
import {localState} from "irisdb"
import {ndk} from "@/utils/ndk"

const channels = new Map<string, Channel | undefined>()

const openedAt = Date.now()

const subscribe = (filter: Filter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (event) => {
    onEvent(event as unknown as VerifiedEvent)
  })
  return () => sub.stop()
}

export async function getChannel(id: string): Promise<Channel | undefined> {
  if (channels.has(id)) return channels.get(id)

  // Mark as loading to prevent duplicate work
  channels.set(id, undefined)

  const state = await localState.get("channels").get(id).get("state").once()

  if (typeof state === "string" && state !== null) {
    const deserialized = deserializeChannelState(state)
    const channel = new Channel(subscribe, deserialized)
    channels.set(id, channel)
    return channel
  }

  return undefined
}

// function that gets all our channels and subscribes to messages from them
export function getChannels() {
  return localState.get("channels").on(async (channelData) => {
    for (const [id, data] of Object.entries(channelData || {})) {
      if (channels.has(id)) continue
      if (data) {
        const channelId = id.split("/").pop()!
        const channel = await getChannel(channelId)
        if (!channel?.onMessage) continue

        channel.onMessage(async (msg) => {
          const message: MessageType = {
            id: msg.id,
            sender: id.split(":").shift()!,
            content: msg.data,
            time: msg.time,
          }
          localState.get("channels").get(id).get("messages").get(msg.id).put(message)
          localState.get("channels").get(id).get("latest").put(message)

          // If visible, update lastSeen. If not, show notification.
          if (
            window.location.pathname.includes(`/messages/${id}`) &&
            document.visibilityState !== "visible"
          ) {
            localState.get("channels").get(id).get("lastSeen").put(Date.now())
          } else if (msg.time > openedAt) {
            const sender = id.split(":").shift()!
            let profile = profileCache.get(sender)
            if (!profile) {
              try {
                profile = await ndk()
                  .getUser({pubkey: sender})
                  .fetchProfile({closeOnEose: true})
              } catch (e) {
                console.warn("Failed to fetch profile for", sender, e)
              }
            }
            const name =
              profile?.name ||
              profile?.display_name ||
              profile?.displayName ||
              profile?.username ||
              profile?.nip05?.split("@")[0] ||
              (sender && AnimalName(sender))
            showNotification(String(name), {
              body: msg.data.length > 100 ? msg.data.slice(0, 100) + "..." : msg.data,
              icon: profile?.picture
                ? `https://imgproxy.iris.to/insecure/rs:fill:128:128/plain/${profile.picture}`
                : "/favicon.png",
              data: {url: `/messages/${id}`},
            })
          }
        })
      }
    }
  })
}

localState.get("user").on((u) => {
  if (!u) return
  getChannels()
})
