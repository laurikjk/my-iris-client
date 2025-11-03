import {ChangeEvent, KeyboardEvent, useEffect, useRef, useState} from "react"
import {generateSecretKey, getPublicKey, nip19} from "nostr-tools"
import {NDKEvent, NDKPrivateKeySigner} from "@nostr-dev-kit/ndk"
import {bytesToHex} from "@noble/hashes/utils"
import {useUserStore} from "@/stores/user"
import {useUIStore} from "@/stores/ui"
import {useSettingsStore} from "@/stores/settings"
import {ndk} from "@/utils/ndk"
import {NSEC_NPUB_REGEX} from "@/utils/validation"

interface SignUpProps {
  onClose: () => void
}

export default function SignUp({onClose}: SignUpProps) {
  const [newUserName, setNewUserName] = useState("")
  const {setShowLoginDialog} = useUIStore()
  const updateAppearance = useSettingsStore((state) => state.updateAppearance)
  const inputRef = useRef<HTMLInputElement>(null)
  const setState = useUserStore.setState

  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      })
    }
  }, [inputRef.current])

  function onNameChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (val.match(NSEC_NPUB_REGEX)) {
      e.preventDefault()
      // Handle npub paste - switch to view-only mode
      if (val.indexOf("npub1") === 0) {
        try {
          const decoded = nip19.decode(val)
          const publicKey = decoded.data as string
          setState({
            publicKey,
            privateKey: "", // No private key for view-only mode
          })
          updateAppearance({singleColumnLayout: false})
          setShowLoginDialog(false)
          onClose()
        } catch (error) {
          console.error("Invalid npub:", error)
        }
      }
      // Handle nsec paste - full login
      else if (val.indexOf("nsec1") === 0) {
        try {
          const decoded = nip19.decode(val)
          const sk = decoded.data as Uint8Array
          const privateKeyHex = bytesToHex(sk)
          const publicKey = getPublicKey(sk)

          setState({
            privateKey: privateKeyHex,
            publicKey,
          })

          localStorage.setItem("cashu.ndk.privateKeySignerPrivateKey", privateKeyHex)
          localStorage.setItem("cashu.ndk.pubkey", publicKey)
          const privateKeySigner = new NDKPrivateKeySigner(privateKeyHex)
          ndk().signer = privateKeySigner

          updateAppearance({singleColumnLayout: false})
          setShowLoginDialog(false)
          onClose()
        } catch (error) {
          console.error("Invalid nsec:", error)
        }
      }
    } else {
      setNewUserName(e.target.value)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleSubmit() {
    ndk()
    const sk = generateSecretKey()
    const pk = getPublicKey(sk)
    const npub = nip19.npubEncode(pk)
    const privateKeyHex = bytesToHex(sk)

    // Update user store directly
    setState({
      privateKey: privateKeyHex,
      publicKey: pk,
      walletConnect: true,
    })

    // Keep these for backward compatibility
    localStorage.setItem("cashu.ndk.privateKeySignerPrivateKey", privateKeyHex)
    localStorage.setItem("cashu.ndk.pubkey", pk)
    const privateKeySigner = new NDKPrivateKeySigner(privateKeyHex)
    ndk().signer = privateKeySigner

    // Only create profile if username is provided
    if (newUserName.trim()) {
      const profileEvent = new NDKEvent(ndk())
      profileEvent.kind = 0
      profileEvent.content = JSON.stringify({
        display_name: newUserName.trim(),
        lud16: `${npub}@npub.cash`,
      })
      profileEvent.publish()
    }

    updateAppearance({singleColumnLayout: false})
    setShowLoginDialog(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col items-center gap-4 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        onKeyDown={handleKeyDown}
      >
        <h1 className="text-2xl font-bold">Sign up</h1>
        <input
          ref={inputRef}
          autoComplete="name"
          autoFocus
          className="input input-bordered"
          type="text"
          placeholder="What's your name?"
          value={newUserName}
          onChange={(e) => onNameChange(e)}
        />
        <button className="btn btn-primary" type="submit">
          Go
        </button>
      </form>
      <div
        className="flex flex-col items-center justify-center gap-4 flex-wrap border-t pt-4 cursor-pointer"
        onClick={onClose}
      >
        <span className="hover:underline">Already have an account?</span>
        <button className="btn btn-sm btn-neutral">Sign in</button>
      </div>
    </div>
  )
}
