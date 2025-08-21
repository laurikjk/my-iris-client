import {Filter, VerifiedEvent} from "nostr-tools"
import {ndk} from "@/utils/ndk"

// Helper subscribe implementation for Session reconstruction
export const sessionSubscribe = (
  filter: Filter,
  onEvent: (event: VerifiedEvent) => void
): (() => void) => {
  console.log("sessionSubscribe called with filter:", filter)
  const sub = ndk().subscribe(filter)
  sub.on("event", (e: unknown) => {
    const event = e as VerifiedEvent
    console.log("sessionSubscribe received event:", {
      id: event?.id,
      kind: event?.kind,
      pubkey: event?.pubkey,
      authors: filter?.authors,
      filterMatch: filter?.authors?.includes(event?.pubkey),
      kindMatch: filter?.kinds?.includes(event?.kind),
    })
    onEvent(event)
  })
  return () => {
    console.log("sessionSubscribe unsubscribing from filter:", filter)
    sub.stop()
  }
}
