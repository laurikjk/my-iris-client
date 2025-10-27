import {NDKEvent, NDKUserProfile, NDKSubscription} from "@nostr-dev-kit/ndk"
import {handleProfile} from "@/utils/profileSearch"
import {PublicKey} from "@/shared/utils/PublicKey"
import {useEffect, useMemo, useState, useRef} from "react"
import {
  profileCache,
  addCachedProfile,
  subscribeToProfileUpdates,
} from "@/utils/profileCache"
import {addUsernameToCache} from "@/utils/usernameCache"
import {ndk} from "@/utils/ndk"
import {KIND_METADATA} from "@/utils/constants"

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

  const [profile, setProfile] = useState<NDKUserProfile | null>(
    profileCache.get(pubKeyHex || "") || null
  )

  const subscriptionRef = useRef<NDKSubscription | null>(null)

  useEffect(() => {
    // Clean up any existing subscription first
    if (subscriptionRef.current) {
      subscriptionRef.current.stop()
      subscriptionRef.current = null
    }

    if (!pubKeyHex) {
      return
    }

    const newProfile = profileCache.get(pubKeyHex || "") || null
    setProfile(newProfile)

    if (newProfile && !subscribe) {
      return
    }

    const sub = ndk().subscribe(
      {kinds: [KIND_METADATA], authors: [pubKeyHex]},
      {closeOnEose: true}
    )
    subscriptionRef.current = sub

    let latest = 0
    sub.on("event", (event: NDKEvent) => {
      if (event.pubkey === pubKeyHex && event.kind === KIND_METADATA) {
        if (!event.created_at || event.created_at <= latest) {
          return
        }
        latest = event.created_at
        const profile = JSON.parse(event.content)
        profile.created_at = event.created_at
        addCachedProfile(pubKeyHex, profile)
        // Also add to username cache if iris.to address
        if (profile.nip05) {
          addUsernameToCache(pubKeyHex, profile.nip05, true)
        }
        setProfile(profile)
        handleProfile(pubKeyHex, profile)
      }
    })

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop()
        subscriptionRef.current = null
      }
    }
  }, [pubKeyHex, subscribe])

  // Subscribe to cache updates
  useEffect(() => {
    if (!pubKeyHex) {
      return undefined
    }

    const unsubscribe = subscribeToProfileUpdates((updatedPubkey, updatedProfile) => {
      if (updatedPubkey === pubKeyHex) {
        setProfile(updatedProfile)
      }
    })

    return unsubscribe
  }, [pubKeyHex])

  return profile
}
