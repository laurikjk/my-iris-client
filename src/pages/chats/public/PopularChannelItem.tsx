import {fetchChannelMetadata, ChannelMetadata} from "../utils/channelMetadata"
import MinidenticonImg from "@/shared/components/user/MinidenticonImg"
import ProxyImg from "@/shared/components/ProxyImg"
import {useEffect, useState} from "react"
import {useNavigate} from "react-router"

type PopularChannelItemProps = {
  channelId: string
  authorCount: number
}

const PopularChannelItem = ({channelId, authorCount}: PopularChannelItemProps) => {
  const navigate = useNavigate()
  const [metadata, setMetadata] = useState<ChannelMetadata | null>(null)

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const data = await fetchChannelMetadata(channelId)
        setMetadata(data)
      } catch (err) {
        // Silently handle errors
      }
    }

    fetchMetadata()
  }, [channelId])

  const handleViewChannel = () => {
    navigate(`/chats/${channelId}`)
  }

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body p-4 flex flex-col h-full">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {metadata?.picture ? (
              <ProxyImg
                src={metadata.picture}
                alt={metadata.name}
                className="w-10 h-10 rounded-full object-cover"
                square={true}
              />
            ) : (
              <MinidenticonImg username={channelId} className="w-10 h-10 rounded-full" />
            )}
            <div>
              <h3 className="font-semibold">
                {metadata?.name || `Channel ${channelId.slice(0, 8)}...`}
              </h3>
              <p className="text-xs text-base-content/70">
                {authorCount} {authorCount === 1 ? "person" : "people"} you follow
              </p>
            </div>
          </div>
          {metadata?.about && (
            <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
              {metadata.about}
            </p>
          )}
        </div>
        <button
          className="btn btn-sm btn-primary w-full mt-auto"
          onClick={handleViewChannel}
        >
          View
        </button>
      </div>
    </div>
  )
}

export default PopularChannelItem
