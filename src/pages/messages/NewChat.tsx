import {useState, useRef, useEffect, ChangeEvent, FormEvent} from "react"
import {Invite, serializeChannelState} from "nostr-double-ratchet"
import QRCodeButton from "@/shared/components/user/QRCodeButton"
import {acceptInvite} from "@/shared/hooks/useInviteFromUrl"
import {NDKEventFromRawEvent} from "@/utils/nostr"
import {nip19, VerifiedEvent} from "nostr-tools"
import {hexToBytes} from "@noble/hashes/utils"
import {useNavigate} from "react-router-dom"
import {useLocalState} from "irisdb-hooks"
import {getInvites} from "./Invites"
import {localState} from "irisdb"
import {ndk} from "@/utils/ndk"

const NewChat = () => {
  const navigate = useNavigate()
  const [myPubKey] = useLocalState("user/publicKey", "")
  const [myPrivKey] = useLocalState("user/privateKey", "")
  const [inviteLinks, setInvites] = useState<Map<string, Invite>>(new Map())
  const [inviteLinkInput, setInviteInput] = useState("")
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return getInvites((id, inviteLink) => {
      setInvites(new Map(inviteLinks.set(id, inviteLink)))
    })
  }, [])

  const createInvite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (labelInputRef.current) {
      const label = labelInputRef.current.value.trim() || "New Invite Link"
      const newLink = Invite.createNew(myPubKey, label)
      const id = crypto.randomUUID()
      localState.get(`inviteLinks/${id}`).put(newLink.serialize())
      setInvites(new Map(inviteLinks.set(id, newLink)))
      labelInputRef.current.value = "" // Clear the input after creating
    }
  }

  const deleteInvite = (id: string) => {
    localState.get(`inviteLinks/${id}`).put(null)
    inviteLinks.delete(id)
    setInvites(new Map(inviteLinks))
  }

  const handleInviteInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setInviteInput(input)

    try {
      const inviteLink = Invite.fromUrl(input)
      const encrypt = myPrivKey
        ? hexToBytes(myPrivKey)
        : async (plaintext: string, pubkey: string) => {
            if (window.nostr?.nip44) {
              return window.nostr.nip44.encrypt(plaintext, pubkey)
            }
            throw new Error("No nostr extension or private key")
          }
      const {channel, event} = await inviteLink.accept(
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
      ndk().publish(e)
      console.log("published event?", event)

      const channelId = `${inviteLink.inviter}:${channel.name}`
      // Save the channel
      localState
        .get(`channels/${channelId}/state`)
        .put(serializeChannelState(channel.state))

      // Navigate to the new chat
      navigate(`/messages/${channelId}`)
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
      <div className="m-4 p-4 md:p-8 rounded-lg bg-base-100 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Have someone&apos;s invite link?</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="input input-bordered w-full md:w-96"
              placeholder="Paste invite link"
              value={inviteLinkInput}
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
            {Array.from(inviteLinks).map(([id, link]) => (
              <div
                key={id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                <span>{link.label}</span>
                <div className="space-x-2 flex items-center">
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
    </>
  )
}

export default NewChat
