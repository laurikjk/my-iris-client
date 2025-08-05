import {CLOUDFLARE_CSAM_FLAGGED} from "@/utils/cloudflare_banned_users"
import {hexToBytes, bytesToHex} from "@noble/hashes/utils"
import {useParams, Link} from "@/navigation"
import {sha256} from "@noble/hashes/sha256"
import {useEffect, useState} from "react"
import {nip05, nip19} from "nostr-tools"
import {Page404} from "@/pages/Page404"
import ThreadPage from "@/pages/thread"
import ProfilePage from "@/pages/user"

const CLOUDFLARE_CSAM_EXPLANATION_NOTE =
  "note1pu5kvxwfzytxsw6vkqd4eu6e0xr8znaur6sl38r4swl3klgsn6dqzlpnsl"
const CLOUDFLARE_CSAM_MESSAGE = "Flagged as CSAM by Cloudflare. See explanation at"

export default function NostrLinkHandler() {
  const {link} = useParams()
  const [error, setError] = useState<string>()
  const [asyncPubkey, setAsyncPubkey] = useState<string>()

  const isProfile = link?.startsWith("npub") || link?.startsWith("nprofile")
  const isNote = link?.startsWith("note") || link?.startsWith("nevent")
  const isAddress = link?.startsWith("naddr")

  // Decode synchronously to avoid loading state
  let pubkey: string | undefined
  let naddrData: {pubkey: string; kind: number; identifier: string} | undefined
  let needsAsyncResolution = false

  try {
    if (link) {
      if (isProfile) {
        const decoded = nip19.decode(link)
        if (
          typeof decoded.data === "object" &&
          decoded.data !== null &&
          "pubkey" in decoded.data
        ) {
          pubkey = decoded.data.pubkey
        } else if (typeof decoded.data === "string" && decoded.data.length === 64) {
          pubkey = decoded.data
        }
      } else if (isAddress) {
        const decoded = nip19.decode(link)
        naddrData = decoded.data as {pubkey: string; kind: number; identifier: string}
      } else if (!isNote && !isProfile && !isAddress) {
        // Username/nip05 - needs async resolution
        needsAsyncResolution = true
      }
    }
  } catch (err) {
    console.error("Decode error:", err)
  }

  const [loading, setLoading] = useState(needsAsyncResolution)

  useEffect(() => {
    if (!needsAsyncResolution || !link) return

    setError(undefined)

    const resolveLink = async () => {
      try {
        // Try exact match first
        let resolved = await nip05.queryProfile(link)

        // If not found and doesn't include @iris.to, try with @iris.to
        if (!resolved && !link.includes("@iris.to")) {
          const withIris = `${link}@iris.to`
          resolved = await nip05.queryProfile(withIris)
        }

        if (resolved) {
          setAsyncPubkey(resolved.pubkey)
        }
      } catch (err) {
        console.error("Resolution error:", err)
      } finally {
        setLoading(false)
      }
    }

    resolveLink()
  }, [link, needsAsyncResolution])

  // Use either sync or async pubkey
  const finalPubkey = pubkey || asyncPubkey

  useEffect(() => {
    if (finalPubkey && (isProfile || !isNote)) {
      const hash = bytesToHex(sha256(hexToBytes(finalPubkey)))
      if (CLOUDFLARE_CSAM_FLAGGED.includes(hash)) {
        setError(`${CLOUDFLARE_CSAM_MESSAGE} /${CLOUDFLARE_CSAM_EXPLANATION_NOTE}`)
      }
    }
  }, [finalPubkey, isProfile, isNote])

  // Determine which content to render
  let content = null
  
  // If link is not yet available, show loading
  if (!link) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (loading) {
    content = (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg" />
      </div>
    )
  } else if (error) {
    content = (
      <section className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold text-primary mb-2">Error</h1>
            <p className="text-xl mb-8">
              {CLOUDFLARE_CSAM_MESSAGE}{" "}
              <Link
                to={`/${CLOUDFLARE_CSAM_EXPLANATION_NOTE}`}
                className="link link-primary"
              >
                {CLOUDFLARE_CSAM_EXPLANATION_NOTE}
              </Link>
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="btn btn-primary btn-lg"
            >
              Go back to homepage
            </button>
          </div>
        </div>
      </section>
    )
  } else if (isProfile && finalPubkey) {
    content = <ProfilePage pubKey={finalPubkey} />
  } else if (isNote) {
    content = <ThreadPage id={link!} />
  } else if (isAddress && naddrData) {
    content = <ThreadPage id={link!} isNaddr={true} naddrData={naddrData} />
  } else if (!isNote && !isProfile && !isAddress && finalPubkey) {
    // Username resolved to pubkey
    content = <ProfilePage pubKey={finalPubkey} />
  } else if (isProfile && !finalPubkey) {
    // Invalid npub/nprofile - show error instead of 404
    content = (
      <section className="hero min-h-screen bg-base-200">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold text-primary mb-2">Invalid Profile Link</h1>
            <p className="text-xl mb-8">The profile link appears to be invalid.</p>
            <button
              onClick={() => (window.location.href = "/")}
              className="btn btn-primary btn-lg"
            >
              Go back to homepage
            </button>
          </div>
        </div>
      </section>
    )
  } else {
    content = <Page404 />
  }

  // Keep the same root structure to prevent remounting
  return <div className="min-h-screen">{content}</div>
}
