import {ndk} from "@/utils/ndk"
import {NDKEvent} from "@/lib/ndk"
import {webrtcLogger} from "./Logger"
import type {SignalingMessage} from "./types"
import {KIND_APP_DATA} from "@/utils/constants"

function uuidv4() {
  return crypto.randomUUID()
}

const WEBRTC_TAG = "webrtc"
const MESSAGE_TIMEOUT = 15000 // 15 seconds

/**
 * Send a WebRTC signaling message publicly
 * Encrypts to recipient if specified, otherwise sends as plain JSON
 */
export async function sendSignalingMessage(
  message: SignalingMessage,
  recipientPubkey?: string
): Promise<void> {
  const ndkInstance = ndk()
  const signer = ndkInstance.signer

  if (!signer) {
    webrtcLogger.error(undefined, "No signer available for sending message")
    return
  }

  let content = JSON.stringify(message)

  // Encrypt if recipient specified
  if (recipientPubkey) {
    try {
      const recipientUser = ndkInstance.getUser({pubkey: recipientPubkey})
      content = await signer.encrypt(recipientUser, content)
    } catch (error) {
      webrtcLogger.error(undefined, "Failed to encrypt message")
      return
    }
  }

  // Create event with tags
  const event = new NDKEvent(ndkInstance)
  event.kind = KIND_APP_DATA
  event.content = content
  event.tags = [
    ["l", WEBRTC_TAG],
    ["d", uuidv4()], // Unique identifier
    ["expiration", Math.floor((Date.now() + MESSAGE_TIMEOUT) / 1000).toString()],
  ]

  const peerId = recipientPubkey ? `${recipientPubkey}:broadcast` : "broadcast:broadcast"
  webrtcLogger.debug(peerId, message.type, "up")

  try {
    await event.publish()
  } catch (error) {
    webrtcLogger.error(undefined, "Failed to publish message")
  }
}

/**
 * Subscribe to WebRTC signaling messages
 * Attempts to decrypt encrypted messages, ignores if decryption fails
 */
export function subscribeToSignaling(
  onMessage: (message: SignalingMessage, senderPubkey: string) => void,
  mutualFollows: Set<string>,
  myPubkey: string
): () => void {
  const ndkInstance = ndk()
  const signer = ndkInstance.signer

  if (!signer) {
    webrtcLogger.error(undefined, "No signer available for subscription")
    return () => {}
  }

  const authors = Array.from(mutualFollows)
  authors.push(myPubkey) // Include self to track other devices

  // Subscribe to kind 30078 events with webrtc tag from mutual follows + self
  // Get messages from last MESSAGE_TIMEOUT seconds to catch recent hellos
  const filter = {
    kinds: [KIND_APP_DATA],
    "#l": [WEBRTC_TAG],
    authors,
    since: Math.floor((Date.now() - MESSAGE_TIMEOUT) / 1000),
  }

  webrtcLogger.debug(
    undefined,
    `Subscribing with filter: ${authors.length} authors, since=${filter.since}`
  )

  const sub = ndkInstance.subscribe(filter, {closeOnEose: false})

  webrtcLogger.info(undefined, `Signaling subscription started: ${sub.internalId}`)

  sub.on("event", async (event: NDKEvent) => {
    // Skip expired events
    const expiration = event.tags.find((tag) => tag[0] === "expiration")?.[1]
    if (expiration && parseInt(expiration) < Date.now() / 1000) {
      webrtcLogger.debug(undefined, "Skipping expired signaling event")
      return
    }

    const senderPubkey = event.pubkey
    let content = event.content

    // Try to decrypt if not plain JSON
    if (!content.startsWith("{")) {
      try {
        const senderUser = ndkInstance.getUser({pubkey: senderPubkey})
        content = await signer.decrypt(senderUser, content)
      } catch (error) {
        // Not for us, silently ignore
        webrtcLogger.debug(undefined, "Failed to decrypt signaling message (not for us)")
        return
      }
    }

    // Parse and handle message
    try {
      const message = JSON.parse(content) as SignalingMessage
      webrtcLogger.debug(`${senderPubkey}:signaling`, message.type, "down")
      onMessage(message, senderPubkey)
    } catch (error) {
      webrtcLogger.error(undefined, "Failed to parse signaling message")
    }
  })

  return () => {
    sub.stop()
  }
}
