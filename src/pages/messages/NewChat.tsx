import {useState, useRef, useEffect, ChangeEvent, FormEvent} from "react"
import NotificationPrompt from "@/shared/components/NotificationPrompt"
import {Invite, serializeSessionState} from "nostr-double-ratchet/src"
import InstallPWAPrompt from "@/shared/components/InstallPWAPrompt"
import QRCodeButton from "@/shared/components/user/QRCodeButton"
import {acceptInvite} from "@/shared/hooks/useInviteFromUrl"
import {useLocalState} from "irisdb-hooks/src/useLocalState"
import Header from "@/shared/components/header/Header"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {nip19, VerifiedEvent} from "nostr-tools"
import {hexToBytes} from "@noble/hashes/utils"
import {useNavigate} from "react-router"
import {getSessions} from "./Sessions"
import {localState} from "irisdb/src"
import {getInvites} from "./Invites"
import {ndk} from "@/utils/ndk"

const NewChat = () => {
  const navigate = useNavigate()
  const [myPubKey] = useLocalState("user/publicKey", "")
  const [myPrivKey] = useLocalState("user/privateKey", "")
  const [invites, setInvites] = useState<Map<string, Invite>>(new Map())
  const [inviteInput, setInviteInput] = useState("")
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (getSessions().size === 0) {
      navigate("/messages/new", {replace: true})
    }

    return localState.get("invites").on(() => {
      setInvites(getInvites())
    })
  }, [navigate])

  const createInvite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (labelInputRef.current) {
      const label = labelInputRef.current.value.trim() || "New Invite Link"
      const newLink = Invite.createNew(myPubKey, label)
      const id = crypto.randomUUID()
      localState.get(`invites/${id}`).put(newLink.serialize())
      setInvites(new Map(invites.set(id, newLink)))
      labelInputRef.current.value = "" // Clear the input after creating
    }
  }

  const deleteInvite = (id: string) => {
    localState.get(`invites/${id}`).put(null)
    invites.delete(id)
    setInvites(new Map(invites))
  }

  const handleInviteInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setInviteInput(input)

    try {
      const invite = Invite.fromUrl(input)
      const encrypt = myPrivKey
        ? hexToBytes(myPrivKey)
        : async (plaintext: string, pubkey: string) => {
            if (window.nostr?.nip44) {
              return window.nostr.nip44.encrypt(plaintext, pubkey)
            }
            throw new Error("No nostr extension or private key")
          }
      const {session, event} = await invite.accept(
        (filter, onEvent) => {
          const sub = ndk().subscribe(filter)
          sub.on("event", (e) => onEvent(e as unknown as VerifiedEvent))
          return () => sub.stop()
        },
        myPubKey,
        encrypt
      )

      // Publish the event
      const e = NDKEventFromRawEvent(event)
      e.publish()
        .then((res) => console.log("published", res))
        .catch((e) => console.warn("Error publishing event:", e))
      console.log("published event?", event)

      const sessionId = `${invite.inviter}:${session.name}`
      // Save the session
      localState
        .get(`sessions/${sessionId}/state`)
        .put(serializeSessionState(session.state))

      // Navigate to the new chat
      navigate("/messages/chat", {state: {id: sessionId}})
    } catch (error) {
      console.error("Invalid invite link:", error)
      // Optionally, you can show an error message to the user here
    }
  }

  const onScanSuccess = (data: string) => {
    acceptInvite(data, myPubKey, myPrivKey, navigate)
  }

  return (
    <>
      <Header title="New Chat" />
      <NotificationPrompt />
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Have someone&apos;s invite link?</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="input input-bordered w-full md:w-96"
              placeholder="Paste invite link"
              value={inviteInput}
              onChange={handleInviteInput}
            />
            <QRCodeButton
              data=""
              showQRCode={false}
              onScanSuccess={(data) => handleInviteInput({target: {value: data}} as any)}
              icon="qr"
            />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4">Share your invite link</h2>
          <form
            onSubmit={createInvite}
            className="flex flex-wrap items-center gap-2 mb-4"
          >
            <input
              ref={labelInputRef}
              type="text"
              placeholder="Label (optional)"
              className="input input-bordered w-full md:w-64"
            />
            <button type="submit" className="btn btn-primary whitespace-nowrap">
              Create Invite Link
            </button>
          </form>
          <div className="space-y-3">
            {Array.from(invites).map(([id, link]) => (
              <div
                key={id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                <span>{link.label}</span>
                <div className="flex gap-4 items-center">
                  <QRCodeButton
                    npub={myPubKey && nip19.npubEncode(myPubKey)}
                    data={link.getUrl()}
                    onScanSuccess={onScanSuccess}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(link.getUrl())}
                    className="btn btn-sm btn-outline"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => deleteInvite(id)}
                    className="btn btn-sm btn-error"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
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
          to keep your messages safe.
        </p>
        <p className="text-center text-sm text-base-content/70">
          Chat history is stored locally on this device and cleared when you log out.
        </p>
      </div>
      <InstallPWAPrompt />
    </>
  )
}

export default NewChat
