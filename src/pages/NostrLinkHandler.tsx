import {useParams, useNavigate, useLocation} from "react-router"
import {queryProfile} from "nostr-tools/nip05"
import {useEffect, useState} from "react"
import ThreadPage from "@/pages/thread"
import ProfilePage from "@/pages/user"
import {nip19} from "nostr-tools"

export default function NostrLinkHandler() {
  const {link} = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const cleanLink = link?.replace(/^web\+nostr:\/\//, "")

  useEffect(() => {
    if (link !== cleanLink) {
      navigate(`/${cleanLink}`, {replace: true})
    }
  }, [link, cleanLink, navigate])

  const isProfile = cleanLink?.startsWith("npub") || cleanLink?.startsWith("nprofile")
  const isNote = cleanLink?.startsWith("note") || cleanLink?.startsWith("nevent")
  const isAddress = cleanLink?.startsWith("naddr")

  const [pubkey, setPubkey] = useState<string | null>(null)
  const [naddrData, setNaddrData] = useState<nip19.AddressPointer | null>(null)
  const [loading, setLoading] = useState(!isProfile && !isNote && !isAddress)

  useEffect(() => {
    setLoading(!isProfile && !isNote && !isAddress)
    setPubkey(null)
    setNaddrData(null)

    if (isProfile || isNote || isAddress) return
    const query = async () => {
      const maybeNip05 = cleanLink?.includes("@") ? cleanLink : `${cleanLink}@iris.to`
      const profile = await queryProfile(maybeNip05)
      if (profile) {
        setPubkey(profile.pubkey)
      }
      setLoading(false)
    }
    query()
  }, [cleanLink, isProfile, isNote, isAddress])

  useEffect(() => {
    if (isAddress && cleanLink) {
      try {
        const decoded = nip19.decode(cleanLink)
        if (decoded.type === "naddr") {
          setNaddrData(decoded.data as nip19.AddressPointer)
        }
      } catch (error) {
        console.warn("Failed to decode naddr:", error)
      }
    }
  }, [cleanLink, isAddress])

  if (pubkey || isProfile) {
    const k = pubkey || cleanLink!
    return <ProfilePage pubKey={k} key={k} />
  } else if (isNote) {
    return <ThreadPage id={cleanLink!} key={location.pathname} />
  } else if (isAddress) {
    return (
      <ThreadPage
        id={cleanLink!}
        isNaddr={true}
        naddrData={naddrData}
        key={location.pathname}
      />
    )
  } else if (loading) {
    return <ProfilePage pubKey={""} key={pubkey || location.pathname} />
  } else {
    return <div className="p-4">Page /{cleanLink} not found</div>
  }
}
