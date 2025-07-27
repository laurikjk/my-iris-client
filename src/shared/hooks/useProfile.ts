import {NDKEvent, NDKUserProfile, NDKSubscription} from "@nostr-dev-kit/ndk"
import {handleProfile} from "@/utils/profileSearch"
import {PublicKey} from "@/shared/utils/PublicKey"
import {useEffect, useMemo, useState, useRef} from "react"
import {profileCache, addCachedProfile} from "@/utils/profileCache"
import {ndk} from "@/utils/ndk"

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
      // Force cleanup by removing from subscription manager (NDK bug workaround)
      if (subscriptionRef.current.ndk?.subManager) {
        subscriptionRef.current.ndk.subManager.subscriptions.delete(subscriptionRef.current.internalId)
      }
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
    
    const sub = ndk().subscribe({kinds: [0], authors: [pubKeyHex]}, {closeOnEose: true})
    subscriptionRef.current = sub
    
    let latest = 0
    sub.on("event", (event: NDKEvent) => {
      if (event.pubkey === pubKeyHex && event.kind === 0) {
        if (!event.created_at || event.created_at <= latest) {
          return
        }
        latest = event.created_at
        const profile = JSON.parse(event.content)
        profile.created_at = event.created_at
        addCachedProfile(pubKeyHex, profile)
        setProfile(profile)
        handleProfile(pubKeyHex, profile)
      }
    })

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.stop()
        // Force cleanup by removing from subscription manager (NDK bug workaround)
        if (subscriptionRef.current.ndk?.subManager) {
          subscriptionRef.current.ndk.subManager.subscriptions.delete(subscriptionRef.current.internalId)
        }
        subscriptionRef.current = null
      }
    }
  }, [pubKeyHex, subscribe])

  return profile
}
