/* eslint-disable @typescript-eslint/no-explicit-any */
import {SubscriberBadge} from "@/shared/components/user/SubscriberBadge"
import {profileCache} from "@/utils/memcache"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import ActiveAccount from "./ActiveAccount"
import ChallengeForm from "./ChallengeForm"
import {useUserStore} from "@/stores/user"
import RegisterForm from "./RegisterForm"
import {useEffect, useState} from "react"
import AccountName from "./AccountName"
import {ndk} from "@/utils/ndk"

// Main component
function IrisAccount() {
  const [irisToActive, setIrisToActive] = useState(false)
  const [existing, setExisting] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showChallenge, setShowChallenge] = useState(false)
  const [pendingUsername, setPendingUsername] = useState("")
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null)
  const [minUsernameLength, setMinUsernameLength] = useState(8)

  const myPubKey = useUserStore.getState().publicKey

  // Fetch user account data
  const checkExistingAccount = async (pub: string) => {
    if (!pub) return

    const url = `${CONFIG.defaultSettings.irisApiUrl}/user/find?public_key=${pub}&nocache=${Date.now()}`
    const res = await fetch(url)

    if (res.status === 200) {
      const json = await res.json()
      console.log("User data:", json)

      // Handle subscription data
      if (json.subscription_plan) {
        const plan = json.subscription_plan.toLowerCase()
        let minLength = 8

        if (plan.includes("vanguard")) minLength = 3
        else if (plan.includes("champion")) minLength = 5
        else if (plan.includes("patron")) minLength = 6

        setSubscriptionPlan(json.subscription_plan)
        setMinUsernameLength(minLength)
      } else {
        setSubscriptionPlan(null)
        setMinUsernameLength(8)
      }

      // Set existing username if available
      if (json.name) setExisting(json)
    }
  }

  // Handle registration
  const handleRegister = (username: string) => {
    setPendingUsername(username)
    setShowChallenge(true)
  }

  // Handle Cloudflare verification
  const handleVerify = async (cfToken: string) => {
    const event = new NDKEvent(ndk())
    event.kind = 1
    event.content = `iris.to/${pendingUsername}`
    await event.sign()

    const res = await fetch(`${CONFIG.defaultSettings.irisApiUrl}/user/signup`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({event: await event.toNostrEvent(), cfToken}),
    })

    if (res.status === 200) {
      setError(null)
      setExisting({name: pendingUsername})
      setShowChallenge(false)
    } else {
      try {
        const json = await res.json()
        setError(json.message || "Error during registration")
      } catch {
        setError("Error during registration")
      }
    }
  }

  // Setup effects
  useEffect(() => {
    // User store subscription handler
    const handleUserChange = (state: any) => {
      const userPubKey = state.publicKey
      if (userPubKey && typeof userPubKey === "string") {
        const userProfile = profileCache.get(userPubKey) || {}
        setProfile(userProfile)

        const isIrisToActive = Boolean(
          userProfile?.nip05 && userProfile.nip05.endsWith("@iris.to")
        )
        setIrisToActive(isIrisToActive)

        checkExistingAccount(userPubKey)
      }
    }

    // Setup subscriptions
    const unsubscribe = useUserStore.subscribe(handleUserChange)
    handleUserChange(useUserStore.getState())

    return () => {
      unsubscribe()
    }
  }, [])

  // Render based on state
  let content
  if (irisToActive) {
    const username = profile?.nip05?.split("@")[0]
    content = (
      <div className="flex flex-col gap-2">
        <AccountName name={username} />
        <SubscriberBadge className="mt-2" pubkey={myPubKey} />
      </div>
    )
  } else if (existing) {
    content = (
      <div className="flex flex-col gap-2">
        <ActiveAccount name={existing.name} setAsPrimary={() => setIrisToActive(true)} />
        <SubscriberBadge className="mt-2" pubkey={myPubKey} />
      </div>
    )
  } else if (error) {
    content = <div className="error">Error: {error}</div>
  } else if (showChallenge) {
    content = <ChallengeForm onVerify={handleVerify} />
  } else {
    content = (
      <div className="flex flex-col">
        <RegisterForm
          minLength={minUsernameLength}
          subscriptionPlan={subscriptionPlan}
          onRegister={handleRegister}
        />
      </div>
    )
  }

  return (
    <>
      {content}
      <p>
        <a href="https://github.com/irislib/faq#iris-username">FAQ</a>
      </p>
    </>
  )
}

export default IrisAccount
