import {useEffect, useState} from "react"
import {nip05, nip19} from "nostr-tools"
import {Page404} from "@/pages/Page404"
import ThreadPage from "@/pages/thread"
import {useParams} from "react-router"
import ProfilePage from "@/pages/user"

export default function NostrLinkHandler() {
  const {link} = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [pubkey, setPubkey] = useState<string>()
  const [naddrData, setNaddrData] = useState<{
    pubkey: string
    kind: number
    identifier: string
  }>()

  const isProfile = link?.startsWith("npub") || link?.startsWith("nprofile")
  const isNote = link?.startsWith("note") || link?.startsWith("nevent")
  const isAddress = link?.startsWith("naddr")

  useEffect(() => {
    setLoading(true)
    setError(undefined)
    setPubkey(undefined)
    setNaddrData(undefined)

    const resolveLink = async () => {
      if (!link) {
        setError("No link provided")
        setLoading(false)
        return
      }

      try {
        if (isProfile) {
          const decoded = nip19.decode(link)
          if (
            typeof decoded.data === "object" &&
            decoded.data !== null &&
            "pubkey" in decoded.data
          ) {
            setPubkey(decoded.data.pubkey)
          } else if (typeof decoded.data === "string" && decoded.data.length === 64) {
            setPubkey(decoded.data)
          } else {
            throw new Error("Invalid NPUB or NPROFILE format: " + link)
          }
        } else if (isAddress) {
          const decoded = nip19.decode(link)
          const data = decoded.data as {pubkey: string; kind: number; identifier: string}
          setNaddrData(data)
        } else if (link.includes("@") || !isNote) {
          // Try exact match first
          let resolved = await nip05.queryProfile(link)

          // If not found and doesn't include @iris.to, try with @iris.to
          if (!resolved && !link.includes("@iris.to")) {
            const withIris = `${link}@iris.to`
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
  }, [link])

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
    return <ThreadPage id={link!} />
  }

  if (isAddress && naddrData) {
    return <ThreadPage id={link!} isNaddr={true} naddrData={naddrData} />
  }

  return <Page404 />
}
