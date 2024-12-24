import {Channel, deserializeChannelState, NostrFilter} from "nostr-double-ratchet"
import {localState, Unsubscribe} from "irisdb"
import {VerifiedEvent} from "nostr-tools"
import {MessageType} from "./Message"
import {ndk} from "irisdb-nostr"

const channels = new Map<string, Channel>()

const subscribe = (filter: NostrFilter, onEvent: (event: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (event) => {
    console.log(event)
    onEvent(event)
  })
  return () => {} // no need to sub.stop(), old nostr senders might still have unseen?
}

export function getChannel(id: string): Channel | undefined {
  if (!channels.has(id)) {
    let unsub: Unsubscribe | undefined = undefined
    unsub = localState
      .get("channels")
      .get(id)
      .get("state")
      .on(
        (state) => {
          console.log("channel state", state, id)
          if (typeof state === "string" && state !== null) {
            const deserialized = deserializeChannelState(state)
            console.log("deserialized", deserialized)
            channels.set(id, new Channel(subscribe, deserialized))
          }
          unsub?.()
        },
        true,
        2
      )
  }
  return channels.get(id)
}

// function that gets all our channels and subscribes to messages from them
export function getChannels() {
  return localState.get("channels").forEach((data, id) => {
    if (channels.has(id)) return
    if (data) {
      console.log("got channel", id, data, typeof data)
      id = id.split("/").pop()!
      const channel = getChannel(id)
      if (!channel) return
      console.log("channel sub")
      channel.onMessage(async (msg) => {
        console.log("received message", msg)

        const message: MessageType = {
          id: msg.id,
          sender: id.split(":").shift()!,
          content: msg.data,
          time: msg.time,
        }
        localState.get("channels").get(id).get("messages").get(msg.id).put(message)
        localState.get("channels").get(id).get("latest").put(msg)
      })
    }
  })
}

localState.get("user").on((u) => {
  if (!u) return
  getChannels()
})
