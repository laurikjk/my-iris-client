import {Filter, VerifiedEvent} from "nostr-tools"
import {ndk} from "@/utils/ndk"

// Helper subscribe implementation for Session reconstruction
export const sessionSubscribe = (
  filter: Filter,
  onEvent: (event: VerifiedEvent) => void
): (() => void) => {
  const sub = ndk().subscribe(filter)
  sub.on("event", (e: unknown) => {
    const event = e as VerifiedEvent
    onEvent(event)
  })
  return () => {
    sub.stop()
  }
}
