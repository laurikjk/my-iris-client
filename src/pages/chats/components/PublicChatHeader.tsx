import MinidenticonImg from "@/shared/components/user/MinidenticonImg"
import Header from "@/shared/components/header/Header"
import ProxyImg from "@/shared/components/ProxyImg"
import {RiEarthLine} from "@remixicon/react"

type ChannelMetadata = {
  name: string
  about: string
  picture: string
  relays: string[]
}

interface PublicChatHeaderProps {
  channelMetadata: ChannelMetadata | null
  channelId: string
}

const PublicChatHeader = ({channelMetadata, channelId}: PublicChatHeaderProps) => {
  return (
    <Header showNotifications={false} scrollDown={true} slideUp={false} bold={false}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 flex items-center justify-center">
          {channelMetadata?.picture ? (
            <ProxyImg
              width={16}
              square={true}
              src={channelMetadata.picture}
              alt="Group Icon"
              className="rounded-full"
            />
          ) : (
            <MinidenticonImg username={channelId || "unknown"} />
          )}
        </div>
        <div className="flex flex-col items-start">
          <span className="font-medium flex items-center gap-1">
            {channelMetadata?.name || "Public Chat"}
          </span>
          <span className="text-xs text-base-content/50 flex items-center gap-1">
            <RiEarthLine className="w-4 h-4" /> Public chat
          </span>
        </div>
      </div>
    </Header>
  )
}

export default PublicChatHeader
