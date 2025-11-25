import {
  NDKEvent,
  NDKUserProfile,
  NDKSubscription,
  NDKSubscriptionCacheUsage,
} from "@/lib/ndk"
import {handleProfile} from "@/utils/profileSearch"
import {PublicKey} from "@/shared/utils/PublicKey"
import {useEffect, useMemo, useState, useRef} from "react"
import {addUsernameToCache} from "@/utils/usernameCache"
import {ndk} from "@/utils/ndk"
import {KIND_METADATA} from "@/utils/constants"
import {getMainThreadDb} from "@/lib/ndk-cache/db"
import {updateNameCache} from "@/utils/profileName"

export default function useProfile(pubKey?: string, subscribe = true) {
  const pubKeyHex = useMemo(() => {
    if (!pubKey) {
      return ""
    }
    try {
      return new PublicKey(pubKey).toString()
    } catch (e) {
      console.warn(`Invalid pubkey: ${pubKey}`)
      return ""
    }
  }, [pubKey])

  const [profile, setProfile] = useState<NDKUserProfile | null>(null)
  const subscriptionRef = useRef<NDKSubscription | null>(null)
  const initialLoadDone = useRef(false)

  // Load from cache on mount
  useEffect(() => {
    if (!pubKeyHex) {
      setProfile(null)
      return
    }

    // Load from Dexie cache
    const db = getMainThreadDb()
    db.profiles
      .get(pubKeyHex)
      .then((cached) => {
        if (cached) {
          setProfile(cached)
          updateNameCache(pubKeyHex, cached)
        }
        initialLoadDone.current = true
      })
      .catch(() => {
        initialLoadDone.current = true
      })
  }, [pubKeyHex])

  // Subscribe to relay updates if requested
  useEffect(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.stop()
      subscriptionRef.current = null
    }

    if (!pubKeyHex) {
      return
    }

    // If subscribe=false, only query cache (already done above)
    if (!subscribe) {
      return
    }

    const sub = ndk().subscribe(
      {kinds: [KIND_METADATA], authors: [pubKeyHex]},
      {
        closeOnEose: true,
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
      }
    )
    subscriptionRef.current = sub

    let latest = profile?.created_at || 0
    sub.on("event", (event: NDKEvent) => {
      if (event.pubkey === pubKeyHex && event.kind === KIND_METADATA) {
        if (!event.created_at || event.created_at <= latest) {
          return
        }
        latest = event.created_at
        try {
          const newProfile = JSON.parse(event.content)
          newProfile.created_at = event.created_at
          if (newProfile.nip05) {
            addUsernameToCache(pubKeyHex, newProfile.nip05, true)
          }
          setProfile(newProfile)
          updateNameCache(pubKeyHex, newProfile)
          handleProfile(pubKeyHex, newProfile)
        } catch {
          // Invalid JSON in profile content
        }
      }
    })

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop()
        subscriptionRef.current = null
      }
    }
  }, [pubKeyHex, subscribe])

  return profile
}
