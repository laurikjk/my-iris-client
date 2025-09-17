import {CLOUDFLARE_CSAM_FLAGGED} from "@/utils/cloudflare_banned_users"
import {hexToBytes, bytesToHex} from "@noble/hashes/utils"
import {useParams, Link} from "@/navigation"
import {sha256} from "@noble/hashes/sha256"
import {useEffect, useState, useMemo, ReactNode} from "react"
import {nip05, nip19} from "nostr-tools"
import {Page404} from "@/pages/Page404"
import ThreadPage from "@/pages/thread"
import ProfilePage from "@/pages/user"
import {useUserStore} from "@/stores/user"
import {getCachedUsername} from "@/utils/usernameCache"

const CLOUDFLARE_CSAM_EXPLANATION_NOTE =
  "note1pu5kvxwfzytxsw6vkqd4eu6e0xr8znaur6sl38r4swl3klgsn6dqzlpnsl"
const CLOUDFLARE_CSAM_MESSAGE = "Flagged as CSAM by Cloudflare. See explanation at"

type ResolvedLink =
  | nip19.DecodedResult
  | {type: "username"; value: string}
  | {type: "error"; message: string}
  | {type: "unknown"}

function parseNostrLink(link: string | undefined, myPubKey?: string): ResolvedLink {
  if (!link) return {type: "unknown"}

  // Check cached username first
  if (myPubKey && getCachedUsername(myPubKey) === link) {
    return nip19.decode(nip19.npubEncode(myPubKey))
  }

  // Try nip19 decode for all bech32 formats
  try {
    return nip19.decode(link)
  } catch {
    // Not a valid bech32 format, assume username
    return {type: "username", value: link}
  }
}

function useResolvedNostrLink(link: string | undefined) {
  const myPubKey = useUserStore((state) => state.publicKey)
  const [error, setError] = useState<string>()
  const [asyncPubkey, setAsyncPubkey] = useState<string>()

  const linkData = useMemo(() => parseNostrLink(link, myPubKey), [link, myPubKey])
  const [loading, setLoading] = useState(linkData.type === "username")

  // Handle async NIP-05 resolution
  useEffect(() => {
    if (linkData.type !== "username" || !link) return

    setError(undefined)

    const resolveLink = async () => {
      try {
        let resolved = await nip05.queryProfile(link)
        if (!resolved && !link.includes("@iris.to")) {
          resolved = await nip05.queryProfile(`${link}@iris.to`)
        }
        if (resolved) setAsyncPubkey(resolved.pubkey)
      } catch (err) {
        console.error("Resolution error:", err)
      } finally {
        setLoading(false)
      }
    }

    resolveLink()
  }, [link, linkData.type])

  const finalPubkey = (() => {
    if (linkData.type === "npub") return linkData.data
    if (linkData.type === "nprofile") return linkData.data.pubkey
    return asyncPubkey
  })()

  // CSAM checking
  useEffect(() => {
    if (finalPubkey && linkData.type !== "note" && linkData.type !== "nevent") {
      const hash = bytesToHex(sha256(hexToBytes(finalPubkey)))
      if (CLOUDFLARE_CSAM_FLAGGED.includes(hash)) {
        setError(`${CLOUDFLARE_CSAM_MESSAGE} /${CLOUDFLARE_CSAM_EXPLANATION_NOTE}`)
      }
    }
  }, [finalPubkey, linkData.type])

  return {linkData, finalPubkey, loading, error}
}

// Reusable Error Screen Component
interface ErrorScreenProps {
  title: string
  message: string | ReactNode
  buttonText?: string
  onButtonClick?: () => void
}

function ErrorScreen({
  title,
  message,
  buttonText = "Go back to homepage",
  onButtonClick = () => (window.location.href = "/"),
}: ErrorScreenProps) {
  return (
    <section className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold text-primary mb-2">{title}</h1>
          <p className="text-xl mb-8">{message}</p>
          <button onClick={onButtonClick} className="btn btn-primary btn-lg">
            {buttonText}
          </button>
        </div>
      </div>
    </section>
  )
}

export default function NostrLinkHandler() {
  const {link} = useParams()
  const {linkData, finalPubkey, loading, error} = useResolvedNostrLink(link)

  const content = useMemo(() => {
    if (!link || loading) {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <div className="loading loading-spinner loading-lg" />
        </div>
      )
    }

    if (error) {
      return (
        <ErrorScreen
          title="Error"
          message={
            <>
              {CLOUDFLARE_CSAM_MESSAGE}{" "}
              <Link
                to={`/${CLOUDFLARE_CSAM_EXPLANATION_NOTE}`}
                className="link link-primary"
              >
                {CLOUDFLARE_CSAM_EXPLANATION_NOTE}
              </Link>
            </>
          }
        />
      )
    }

    switch (linkData.type) {
      case "npub":
        return <ProfilePage pubKey={linkData.data} />
      case "nprofile":
        return <ProfilePage pubKey={linkData.data.pubkey} />
      case "note":
        return <ThreadPage id={linkData.data} />
      case "nevent":
        return <ThreadPage id={linkData.data.id} />
      case "naddr":
        return <ThreadPage id={link} isNaddr={true} naddrData={linkData.data} />
      case "username":
        return finalPubkey ? <ProfilePage pubKey={finalPubkey} /> : <Page404 />
      case "error":
        return <ErrorScreen title="Invalid Link" message={linkData.message} />
      case "unknown":
        return <Page404 />
    }
  }, [link, loading, error, linkData, finalPubkey])

  return <div className="flex flex-col flex-1 min-h-0">{content}</div>
}
