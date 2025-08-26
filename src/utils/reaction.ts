import {NDKEvent, NostrEvent} from "@nostr-dev-kit/ndk"
import {KIND_REACTION, KIND_TEXT_NOTE} from "./constants"

/**
 * React to an event with expiration inheritance
 * If the target event has an expiration tag, the reaction will inherit it
 */
export async function reactWithExpiration(
  event: NDKEvent,
  content: string
): Promise<NDKEvent> {
  if (!event.ndk) throw new Error("No NDK instance found")
  event.ndk.assertSigner()

  // Create reaction event
  const reactionEvent = new NDKEvent(event.ndk, {
    kind: KIND_REACTION,
    content,
  } as NostrEvent)

  // Add reference to the event being reacted to
  reactionEvent.tag(event)

  // Add [ "k", kind ] for all non-kind:1 events
  if (event.kind !== KIND_TEXT_NOTE) {
    reactionEvent.tags.push(["k", `${event.kind}`])
  }

  // Get expiration from the target event and add it if present
  const expirationTag = event.tags.find((tag) => tag[0] === "expiration" && tag[1])
  if (expirationTag) {
    reactionEvent.tags.push(["expiration", expirationTag[1]])
  }

  // Sign and publish
  await reactionEvent.publish()

  return reactionEvent
}
