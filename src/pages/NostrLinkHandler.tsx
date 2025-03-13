import {useParams, useNavigate} from "react-router"
import {useEffect, useState, useMemo} from "react"
import {nip05, nip19} from "nostr-tools"
import {Page404} from "@/pages/Page404"
import ThreadPage from "@/pages/thread"
import ProfilePage from "@/pages/user"

export default function NostrLinkHandler() {
  const {link} = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [pubkey, setPubkey] = useState<string>()
  const [naddrData, setNaddrData] = useState<{
    pubkey: string
    kind: number
    identifier: string
  }>()

  // Clean web+nostr:// prefix if present
  const cleanLink = useMemo(() => link?.replace(/^web\+nostr:\/\//, ""), [link])

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

      try {
        if (isProfile) {
          const decoded = nip19.decode(cleanLink)
          setPubkey(decoded.data as string)
        } else if (isAddress) {
          const decoded = nip19.decode(cleanLink)
          const data = decoded.data as {pubkey: string; kind: number; identifier: string}
          setNaddrData(data)
        } else if (cleanLink.includes("@") || !isNote) {
          // Try exact match first
          let resolved = await nip05.queryProfile(cleanLink)

          // If not found and doesn't include @iris.to, try with @iris.to
          if (!resolved && !cleanLink.includes("@iris.to")) {
            const withIris = `${cleanLink}@iris.to`
            resolved = await nip05.queryProfile(withIris)
          }

          if (!resolved) throw new Error("NIP-05 address not found")
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
    return <ProfilePage pubKey={pubkey} />
  }

  if (isNote) {
    return <ThreadPage id={cleanLink!} />
  }

  if (isAddress && naddrData) {
    return <ThreadPage id={cleanLink!} isNaddr={true} naddrData={naddrData} />
  }

  return <Page404 />
}
