import {useEffect, useRef} from "react"
import {useNavigate} from "react-router"
import {VerifiedEvent} from "nostr-tools"
import {NDKSubscription} from "@nostr-dev-kit/ndk"
import {useSessionsStore} from "@/stores/sessions"
import {useUserStore} from "@/stores/user"
import {ndk} from "@/utils/ndk"
import {Invite} from "nostr-double-ratchet/src"
import DoubleRatchetInfo from "../group/components/DoubleRatchetInfo"
import {DoubleRatchetUserSearch} from "../components/DoubleRatchetUserSearch"
import {DoubleRatchetUser} from "../utils/doubleRatchetUsers"

const PrivateChatCreation = () => {
  const navigate = useNavigate()
  const {sessions} = useSessionsStore()
  const myPubKey = useUserStore((state) => state.publicKey)
  const subRef = useRef<NDKSubscription | null>(null)

  useEffect(() => {
    if (sessions.size === 0) {
      navigate("/chats/new", {replace: true})
    }
  }, [navigate, sessions.size])

  const handleStartChat = async (user: DoubleRatchetUser) => {
    if (!myPubKey) return
    // Subscribe function as in ProfileHeader
    subRef.current?.stop()
    const sub = ndk().subscribe({
      kinds: [30078],
      authors: [user.pubkey],
      "#l": ["double-ratchet/invites"],
    })
    subRef.current = sub
    let started = false
    sub.on("event", async (e) => {
      console.log("event", e)
      const inv = Invite.fromEvent(e as unknown as VerifiedEvent)
      console.log("inv", inv)
      if (!inv) return
      const sessionId = await useSessionsStore.getState().acceptInvite(inv.getUrl())
      if (started) return
      started = true
      navigate("/chats/chat", {state: {id: sessionId}})
      sub.stop()
    })
  }

  useEffect(() => {
    return () => {
      if (subRef.current) {
        subRef.current.stop()
      }
    }
  }, [])

  if (!myPubKey) {
    return (
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100">
        <p className="text-center text-base-content/70">
          Please sign in to use private chats
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Search Users</h2>
          <DoubleRatchetUserSearch
            placeholder="Search for users"
            onUserSelect={handleStartChat}
            maxResults={10}
            showCount={true}
          />
        </div>
      </div>
      <hr className="mx-4 my-6 border-base-300" />
      <div className="px-2">
        <DoubleRatchetInfo />
      </div>
    </>
  )
}

export default PrivateChatCreation
