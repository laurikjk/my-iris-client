import {NDKEvent, NDKUserProfile} from "@nostr-dev-kit/ndk"
import {handleProfile} from "@/utils/profileSearch"
import {PublicKey} from "@/shared/utils/PublicKey"
import {useEffect, useMemo, useState} from "react"
import {profileCache, addCachedProfile} from "@/utils/memcache"
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

  useEffect(() => {
    if (!pubKeyHex) {
      return
    }
    const newProfile = profileCache.get(pubKeyHex || "") || null
    setProfile(newProfile)
    if (newProfile && !subscribe) {
      return
    }
    const sub = ndk().subscribe({kinds: [0], authors: [pubKeyHex]}, {closeOnEose: false})
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
      sub.stop()
    }
  }, [pubKeyHex])

  return profile
}
