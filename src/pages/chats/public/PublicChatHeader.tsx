import {fetchChannelMetadata, ChannelMetadata} from "../utils/channelMetadata"
import MinidenticonImg from "@/shared/components/user/MinidenticonImg"
import Header from "@/shared/components/header/Header"
import ProxyImg from "@/shared/components/ProxyImg"
import {RiEarthLine} from "@remixicon/react"
import {useEffect, useState} from "react"
import {Link} from "react-router"

interface PublicChatHeaderProps {
  channelId: string
}

const PublicChatHeader = ({channelId}: PublicChatHeaderProps) => {
  const [channelMetadata, setChannelMetadata] = useState<ChannelMetadata | null>(null)
  const [showPlaceholder, setShowPlaceholder] = useState(false)

  useEffect(() => {
    const fetchMetadata = async () => {
      const metadata = await fetchChannelMetadata(channelId)
      setChannelMetadata(metadata)
    }

    fetchMetadata()
  }, [channelId])

  useEffect(() => {
    // Set a timeout to show the placeholder after 2 seconds if metadata hasn't loaded
    const timer = setTimeout(() => {
      if (!channelMetadata) {
        setShowPlaceholder(true)
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [channelMetadata])

  const renderTitle = () => {
    if (channelMetadata?.name) return channelMetadata.name
    if (showPlaceholder) return `Channel ${channelId.slice(0, 8)}...`
    return "\u00A0"
  }

  const renderIcon = () => {
    if (channelMetadata?.picture) {
      return (
        <ProxyImg
          width={16}
          square={true}
          src={channelMetadata.picture}
          alt="Group Icon"
          className="rounded-full"
        />
      )
    }
    return <MinidenticonImg username={channelId} width={16} />
  }

  return (
    <Header title={renderTitle()} showBack showNotifications={false} scrollDown={true} slideUp={false} bold={false}>
      <Link to={`/chats/${channelId}/details`} className="flex items-center gap-2 w-full">
        <div className="w-8 h-8 flex items-center justify-center">{renderIcon()}</div>
        <div className="flex flex-col items-start">
          <span className="font-medium flex items-center gap-1">{renderTitle()}</span>
          <span className="text-xs text-base-content/50 flex items-center gap-1">
            <RiEarthLine className="w-4 h-4" /> Public chat
          </span>
        </div>
      </Link>
    </Header>
  )
}

export default PublicChatHeader
