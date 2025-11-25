import socialGraph, {handleSocialGraphEvent} from "@/utils/socialGraph.ts"
import {PublicKey} from "@/shared/utils/PublicKey"
import {useEffect, useState, useMemo, useRef} from "react"
import {NostrEvent} from "nostr-social-graph"
import {NDKEvent, NDKSubscription} from "@/lib/ndk"
import {ndk} from "@/utils/ndk"
import {KIND_MUTE_LIST, DEBUG_NAMESPACES} from "@/utils/constants"
import {createDebugLogger} from "@/utils/createDebugLogger"

const {log, warn} = createDebugLogger(DEBUG_NAMESPACES.UTILS)

const useMutes = (pubKey?: string) => {
  const pubKeyHex = useMemo(
    () => (pubKey ? new PublicKey(pubKey).toString() : socialGraph().getRoot()),
    [pubKey]
  )
  const [mutes, setMutes] = useState<string[]>([
    ...socialGraph().getMutedByUser(pubKeyHex),
  ])
  const subscriptionRef = useRef<NDKSubscription | null>(null)

  useEffect(() => {
    // Clean up any existing subscription first
    if (subscriptionRef.current) {
      subscriptionRef.current.stop()
      subscriptionRef.current = null
    }

    try {
      if (pubKeyHex) {
        const filter = {kinds: [KIND_MUTE_LIST], authors: [pubKeyHex]}

        const sub = ndk().subscribe(filter, {closeOnEose: true})
        subscriptionRef.current = sub

        let latestTimestamp = 0

        sub?.on("event", (event: NDKEvent) => {
          event.ndk = ndk()
          socialGraph().handleEvent(event as NostrEvent)
          if (event && event.created_at && event.created_at > latestTimestamp) {
            log(`Mute event received: ${event.kind} ${event.pubkey} ${event.created_at}`)
            latestTimestamp = event.created_at
            handleSocialGraphEvent(event as NostrEvent)
            const pubkeys = event
              .getMatchingTags("p")
              .map((pTag) => pTag[1])
              .sort((a, b) => {
                return (
                  socialGraph().getFollowDistance(a) - socialGraph().getFollowDistance(b)
                )
              })
            setMutes(pubkeys)
          }
        })
      }
    } catch (error) {
      warn(error)
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop()
        subscriptionRef.current = null
      }
    }
  }, [pubKeyHex])

  return mutes
}

export default useMutes
