import {Session, Invite, serializeSessionState} from "nostr-double-ratchet"
import {subscribeToAuthorDMNotifications} from "@/utils/notifications"
import {NDKEventFromRawEvent, RawEvent} from "@/utils/nostr"
import {Filter, VerifiedEvent} from "nostr-tools"
import {hexToBytes} from "@noble/hashes/utils"
import {localState, Unsubscribe} from "irisdb"
import debounce from "lodash/debounce"
import {ndk} from "@/utils/ndk"

const invites = new Map<string, Invite>()
const subscriptions = new Map<string, Unsubscribe>()

let user: {publicKey?: string; privateKey?: string} | null = null

export function loadInvites(): Unsubscribe {
  invites.clear() // Clear the existing map before repopulating

  localState.get("invites").put({}) // Ensure the invites object exists
  localState.get("invites").on(() => subscribeToAuthorDMNotifications())
  return localState.get("invites").forEach((link, path) => {
    const id = path.split("/").pop()!
    if (link && typeof link === "string") {
      try {
        if (!invites.has(id)) {
          const invite = Invite.deserialize(link)
          invites.set(id, invite)
          listen()
        }
      } catch (e) {
        console.error(e)
      }
    }
  })
}

const nostrSubscribe = (filter: Filter, onEvent: (e: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (event) => {
    onEvent(event as unknown as VerifiedEvent)
  })
  return () => sub.stop()
}

const listen = debounce(() => {
  if (user?.publicKey) {
    for (const id of invites.keys()) {
      if (!subscriptions.has(id)) {
        const invite = invites.get(id)!
        const decrypt = user.privateKey
          ? hexToBytes(user.privateKey)
          : async (cipherText: string, pubkey: string) => {
              if (window.nostr?.nip44) {
                const result = await window.nostr.nip44.decrypt(pubkey, cipherText)
                if (!result || typeof result !== "string") {
                  throw new Error("Failed to decrypt")
                }
                return result
              }
              throw new Error("No nostr extension or private key")
            }
        const unsubscribe = invite.listen(
          decrypt,
          nostrSubscribe,
          (session: Session, identity?: string) => {
            const sessionId = `${identity}:${session.name}`
            localState
              .get("sessions")
              .get(sessionId)
              .get("state")
              .put(serializeSessionState(session.state))
          }
        )
        subscriptions.set(id, unsubscribe)
      }
    }
  }
}, 100)

const publish = debounce(async (invite: Invite) => {
  const event = invite.getEvent() as RawEvent
  await NDKEventFromRawEvent(event).publish()
}, 100)

localState.get("user").on(async (u) => {
  if (u) {
    user = u as {publicKey?: string; privateKey?: string}
    if (!user.publicKey) return
    listen()
    const publicInvite = await localState
      .get("invites")
      .get("public")
      .once(undefined, true)
    if (publicInvite && typeof publicInvite === "string") {
      const invite = Invite.deserialize(publicInvite)
      setTimeout(() => {
        publish(invite)
      }, 1000)
    } else {
      console.log("Creating public invite")
      const invite = Invite.createNew(user.publicKey, "Public Invite")
      localState.get("invites").get("public").put(invite.serialize())
      publish(invite)
      console.log("Published public invite", invite)
    }
  }
})

export const getInvites = () => invites
