import {
  Channel,
  InviteLink,
  NostrFilter,
  serializeChannelState,
} from "nostr-double-ratchet"
import {showNotification, subscribeToAuthorDMNotifications} from "@/utils/notifications"
import SnortApi, {Subscription} from "@/utils/SnortApi"
import {hexToBytes} from "@noble/hashes/utils"
import {localState, Unsubscribe} from "irisdb"
import {VerifiedEvent} from "nostr-tools"
import debounce from "lodash/debounce"
import {ndk} from "@/utils/ndk"

const inviteLinks = new Map<string, InviteLink>()
const subscriptions = new Map<string, Unsubscribe>()

let user: {publicKey?: string; privateKey?: string} | null = null

export function getInviteLinks(
  callback: (id: string, inviteLink: InviteLink) => void
): Unsubscribe {
  inviteLinks.clear() // Clear the existing map before repopulating

  return localState.get("inviteLinks").forEach((link, path) => {
    const id = path.split("/").pop()!
    if (link && typeof link === "string") {
      try {
        const inviteLink = InviteLink.deserialize(link)
        callback(id, inviteLink)
      } catch (e) {
        console.error(e)
      }
    }
  })
}

const nostrSubscribe = (filter: NostrFilter, onEvent: (e: VerifiedEvent) => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (event) => {
    onEvent(event as unknown as VerifiedEvent)
  })
  return () => sub.stop()
}

const listen = debounce(() => {
  if (user?.publicKey) {
    for (const id of inviteLinks.keys()) {
      if (!subscriptions.has(id)) {
        const inviteLink = inviteLinks.get(id)!
        const decrypt = user.privateKey
          ? hexToBytes(user.privateKey)
          : async (cipherText: string, pubkey: string) => {
              if (window.nostr?.nip44) {
                const result = window.nostr.nip44.decrypt(pubkey, cipherText)
                if (!result || typeof result !== "string") {
                  throw new Error("Failed to decrypt")
                }
                return result as string
              }
              throw new Error("No nostr extension or private key")
            }
        const unsubscribe = inviteLink.listen(
          decrypt,
          nostrSubscribe,
          (channel: Channel, identity?: string) => {
            const channelId = `${identity}:${channel.name}`
            try {
              subscribeToAuthorDMNotifications([channel.state.theirNostrPublicKey])
            } catch (e) {
              console.error("Error subscribing to author DM notifications", e)
            }

            localState
              .get("channels")
              .get(channelId)
              .get("state")
              .put(serializeChannelState(channel.state))

            showNotification("New chat via invite link", {
              data: {
                url: `/messages/${identity}`,
              },
            })
          }
        )
        subscriptions.set(id, unsubscribe)
      }
    }
  }
}, 100)

const subscribeInviteLinkNotifications = debounce(async () => {
  console.log("Checking for missing subscriptions", {
    size: inviteLinks.size,
    links: Array.from(inviteLinks.entries()),
  })

  if (inviteLinks.size === 0) return

  try {
    const subscriptions = await new SnortApi().getSubscriptions()

    const missing = Array.from(inviteLinks.values()).filter(
      (link) =>
        !Object.values(subscriptions).find(
          (sub: Subscription) =>
            sub.filter.kinds?.includes(4) &&
            (sub.filter as any)["#e"]?.includes(link.inviterSessionPublicKey)
        )
    )

    console.log("Processing subscriptions:", {
      inviteLinks: Array.from(inviteLinks.entries()),
      subscriptions,
      missing,
    })

    if (missing.length) {
      const dmSubscription = Object.entries(subscriptions).find(
        ([, sub]) => sub.filter.kinds?.length === 1 && sub.filter.kinds[0] === 4
      )

      if (dmSubscription) {
        const [id, sub] = dmSubscription
        await new SnortApi().updateSubscription(id, {
          filter: {
            ...sub.filter,
            "#e": [
              ...new Set([
                ...((sub.filter as any)["#e"] || []),
                ...missing.map((l) => l.inviterSessionPublicKey),
              ]),
            ],
          },
        })
      } else {
        await new SnortApi().createSubscription({
          kinds: [4],
          "#e": missing.map((l) => l.inviterSessionPublicKey),
        })
      }
    }
  } catch (e) {
    console.error("Error in subscribeInviteLinkNotifications:", e)
  }
}, 100)

getInviteLinks((id, inviteLink) => {
  if (!inviteLinks.has(id)) {
    inviteLinks.set(id, inviteLink)
    listen()
    setTimeout(() => {
      console.log("Triggering subscription check with size:", inviteLinks.size)
      subscribeInviteLinkNotifications()
    }, 0)
  }
})

localState.get("user").on((u) => {
  if (u) {
    user = u as {publicKey?: string; privateKey?: string}
    listen()
  }
})
