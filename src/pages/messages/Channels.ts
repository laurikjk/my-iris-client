import {Channel, deserializeChannelState, NostrFilter} from "nostr-double-ratchet"
import {VerifiedEvent} from "nostr-tools"
import {MessageType} from "./Message"
import {localState} from "irisdb"
import {ndk} from "irisdb-nostr"

const channels = new Map<string, Channel | undefined>()

const subscribe = (filter: NostrFilter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (event) => {
    console.log(event)
    onEvent(event)
  })
  return () => {} // no need to sub.stop(), old nostr senders might still have unseen?
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
  return localState
    .get("channels")
    .once()
    .then(async (channelData) => {
      for (const [id, data] of Object.entries(channelData || {})) {
        if (channels.has(id)) continue
        if (data) {
          const channelId = id.split("/").pop()!
          const channel = await getChannel(channelId)
          if (!channel?.onMessage) continue

          channel.onMessage(async (msg) => {
            console.log("received message", msg)

            const message: MessageType = {
              id: msg.id,
              sender: id.split(":").shift()!,
              content: msg.data,
              time: msg.time,
            }
            localState.get("channels").get(id).get("messages").get(msg.id).put(message)
            console.log("puttin mesg", msg)
            localState.get("channels").get(id).get("latest").put(msg)
          })
        }
      }
    })
}

localState.get("user").on((u) => {
  if (!u) return
  getChannels()
})
