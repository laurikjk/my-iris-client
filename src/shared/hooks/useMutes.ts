import socialGraph, {handleSocialGraphEvent} from "@/utils/socialGraph.ts"
import {useEffect, useState, useMemo} from "react"
import {NostrEvent} from "nostr-social-graph"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {ndk, PublicKey} from "irisdb-nostr"

const useMutes = (pubKey?: string) => {
  const pubKeyHex = useMemo(
    () => (pubKey ? new PublicKey(pubKey).toString() : socialGraph().getRoot()),
    [pubKey]
  )
  const [mutes, setMutes] = useState<string[]>([
    ...socialGraph().getMutedByUser(pubKeyHex),
  ])

  useEffect(() => {
    try {
      if (pubKeyHex) {
        const filter = {kinds: [10000], authors: [pubKeyHex]}

        const sub = ndk().subscribe(filter)

        let latestTimestamp = 0

        sub?.on("event", (event: NDKEvent) => {
          event.ndk = ndk()
          socialGraph().handleEvent(event as NostrEvent)
          if (event && event.created_at && event.created_at > latestTimestamp) {
            console.log(
              `Mute event received: ${event.kind} ${event.pubkey} ${event.created_at}`
            )
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
        return () => {
          sub.stop()
        }
      }
    } catch (error) {
      console.warn(error)
    }
  }, [pubKeyHex])

  return mutes
}

export default useMutes
