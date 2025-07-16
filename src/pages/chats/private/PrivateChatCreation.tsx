import {
  searchDoubleRatchetUsers,
  subscribeToDoubleRatchetUsers,
  DoubleRatchetUser,
  getDoubleRatchetUsersCount,
} from "../utils/doubleRatchetUsers"
import {UserRow} from "@/shared/components/user/UserRow"
import {useSessionsStore} from "@/stores/sessions"
import {Invite} from "nostr-double-ratchet/src"
import {useUserStore} from "@/stores/user"
import {VerifiedEvent} from "nostr-tools"
import {useState, useEffect} from "react"
import {useNavigate} from "react-router"
import {ndk} from "@/utils/ndk"

const PrivateChatCreation = () => {
  const navigate = useNavigate()
  const {sessions} = useSessionsStore()
  const [searchInput, setSearchInput] = useState("")
  const [searchResults, setSearchResults] = useState<DoubleRatchetUser[]>([])
  const [doubleRatchetCount, setDoubleRatchetCount] = useState(0)
  const myPubKey = useUserStore((state) => state.publicKey)

  useEffect(() => {
    subscribeToDoubleRatchetUsers(myPubKey)
    if (sessions.size === 0) {
      navigate("/chats/new", {replace: true})
    }
    const interval = setInterval(() => {
      setDoubleRatchetCount(getDoubleRatchetUsersCount())
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [navigate, myPubKey, sessions.size])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    const results = searchDoubleRatchetUsers(value)
    setSearchResults(results.slice(0, 10))
  }

  const handleStartChat = async (pubkey: string) => {
    if (!myPubKey) return
    // Subscribe function as in ProfileHeader
    const sub = ndk().subscribe({
      kinds: [30078],
      authors: [pubkey],
      "#l": ["double-ratchet/invites"],
    })
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
          <div className="flex flex-col gap-4">
            <div>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Search for users"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <p className="text-sm text-base-content/70">
              {doubleRatchetCount} followed users have enabled secure DMs
            </p>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {searchResults.map((user) => (
                <button
                  key={user.pubkey}
                  className="btn btn-ghost justify-start text-left"
                  onClick={() => handleStartChat(user.pubkey)}
                >
                  <UserRow pubKey={user.pubkey} linkToProfile={false} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <hr className="mx-4 my-6 border-base-300" />
      <div className="px-2">
        <p className="text-center text-sm text-base-content/70">
          Iris uses Signal-style{" "}
          <a
            href="https://github.com/mmalmi/nostr-double-ratchet"
            target="_blank"
            className="link"
            rel="noreferrer"
          >
            double ratchet encryption
          </a>{" "}
          to keep your private messages safe.
        </p>
        <p className="text-center text-sm text-base-content/70">
          Private chat history is stored locally on this device and cleared when you log
          out.
        </p>
      </div>
    </>
  )
}

export default PrivateChatCreation
