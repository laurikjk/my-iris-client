import socialGraph, {handleSocialGraphEvent} from "@/utils/socialGraph.ts"
import {PublicKey} from "@/shared/utils/PublicKey"
import {useEffect, useState, useMemo} from "react"
import {NostrEvent} from "nostr-social-graph"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {ndk} from "@/utils/ndk"

const useFollows = (pubKey: string | null | undefined, includeSelf = false) => {
  const pubKeyHex = useMemo(
    () => (pubKey ? new PublicKey(pubKey).toString() : ""),
    [pubKey]
  )
  const [follows, setFollows] = useState<string[]>([])

  // Initialize follows when pubKeyHex changes
  useEffect(() => {
    if (pubKeyHex) {
      setFollows([...socialGraph().getFollowedByUser(pubKeyHex, includeSelf)])
    } else {
      setFollows([])
    }
  }, [pubKeyHex, includeSelf])

  useEffect(() => {
    try {
      if (pubKeyHex) {
        const filter = {kinds: [3], authors: [pubKeyHex]}

        const sub = ndk().subscribe(filter)

        let latestTimestamp = 0

        sub?.on("event", (event: NDKEvent) => {
          event.ndk = ndk()
          socialGraph().handleEvent(event as NostrEvent)
          if (event && event.created_at && event.created_at > latestTimestamp) {
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
            if (includeSelf && pubKey) {
              pubkeys.unshift(pubKey)
            }
            setFollows(pubkeys)
          }
        })
        return () => {
          sub.stop()
        }
      }
    } catch (error) {
      console.warn(error)
    }
  }, [pubKeyHex, includeSelf, pubKey])

  return follows
}

export default useFollows
