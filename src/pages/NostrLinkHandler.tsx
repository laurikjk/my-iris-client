import {useParams, useNavigate, useLocation} from "react-router"
import {useEffect, useState} from "react"
import {nip05, nip19} from "nostr-tools"
import {Page404} from "@/pages/Page404"
import ThreadPage from "@/pages/thread"
import ProfilePage from "@/pages/user"

export default function NostrLinkHandler() {
  const {link} = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [pubkey, setPubkey] = useState<string>()
  const [naddrData, setNaddrData] = useState<{
    pubkey: string
    kind: number
    identifier: string
  }>()

  // Clean web+nostr:// prefix if present
  const cleanLink = link?.replace(/^web\+nostr:\/\//, "")

  useEffect(() => {
    if (link !== cleanLink) {
      navigate(`/${cleanLink}`, {replace: true})
    }
  }, [link, cleanLink, navigate])

  const isProfile = cleanLink?.startsWith("npub") || cleanLink?.startsWith("nprofile")
  const isNote = cleanLink?.startsWith("note") || cleanLink?.startsWith("nevent")
  const isAddress = cleanLink?.startsWith("naddr")

  useEffect(() => {
    const resolveLink = async () => {
      if (!cleanLink) {
        setError("No link provided")
        setLoading(false)
        return
      }

      console.log("Resolving link:", cleanLink)
      try {
        if (isProfile) {
          const decoded = nip19.decode(cleanLink)
          setPubkey(decoded.data as string)
        } else if (isAddress) {
          const decoded = nip19.decode(cleanLink)
          setNaddrData(decoded.data as any)
        } else if (cleanLink.includes("@") || !isNote) {
          // Try exact match first
          console.log("Attempting NIP-05 resolution for:", cleanLink)
          let resolved = await nip05.queryProfile(cleanLink)
          console.log("First attempt result:", resolved)

          // If not found and doesn't include @iris.to, try with @iris.to
          if (!resolved && !cleanLink.includes("@iris.to")) {
            const withIris = `${cleanLink}@iris.to`
            console.log("Trying with iris.to:", withIris)
            resolved = await nip05.queryProfile(withIris)
            console.log("Second attempt result:", resolved)
          }

          if (!resolved) throw new Error("NIP-05 address not found")
          console.log("Setting pubkey to:", resolved.pubkey)
          setPubkey(resolved.pubkey)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error("Resolution error:", err)
        setError(err instanceof Error ? err.message : "Failed to resolve link")
      }
      setLoading(false)
    }

    resolveLink()
  }, [cleanLink, isProfile, isAddress, isNote])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (error) {
    return <Page404 />
  }

  if ((isProfile || !isNote) && pubkey) {
    return <ProfilePage pubKey={pubkey} key={pubkey || location.pathname} />
  }

  if (isNote) {
    return <ThreadPage id={cleanLink!} key={location.pathname} />
  }

  if (isAddress && naddrData) {
    return (
      <ThreadPage
        id={cleanLink!}
        isNaddr={true}
        naddrData={naddrData}
        key={location.pathname}
      />
    )
  }

  return <Page404 />
}
