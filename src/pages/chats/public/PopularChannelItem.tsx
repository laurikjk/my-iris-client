import {useNavigate} from "react-router"
import {fetchChannelMetadata, ChannelMetadata} from "../utils/channelMetadata"
import {useEffect, useState} from "react"
import ProxyImg from "@/shared/components/ProxyImg"

type PopularChannelItemProps = {
  channelId: string
  authorCount: number
}

const PopularChannelItem = ({channelId, authorCount}: PopularChannelItemProps) => {
  const navigate = useNavigate()
  const [metadata, setMetadata] = useState<ChannelMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoading(true)
      setError(null)
      try {
        console.log("Fetching metadata for channel:", channelId)
        const data = await fetchChannelMetadata(channelId)
        console.log("Channel metadata:", data)
        setMetadata(data)
      } catch (err) {
        console.error("Error fetching channel metadata:", err)
        setError("Failed to load channel metadata")
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetadata()
  }, [channelId])

  const handleViewChannel = () => {
    navigate(`/chats/${channelId}`)
  }

  if (isLoading) {
    return (
      <div className="card bg-base-200 shadow-md animate-pulse">
        <div className="card-body p-4">
          <div className="h-10 w-10 rounded-full bg-base-300"></div>
          <div className="h-4 w-3/4 bg-base-300 rounded mt-2"></div>
          <div className="h-3 w-1/2 bg-base-300 rounded mt-2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card bg-base-200 shadow-md">
        <div className="card-body p-4">
          <div className="text-error text-sm">Failed to load channel</div>
          <button
            className="btn btn-sm btn-primary w-full mt-2"
            onClick={handleViewChannel}
          >
            View Channel
          </button>
        </div>
      </div>
    )
  }

  if (!metadata) {
    return (
      <div className="card bg-base-200 shadow-md">
        <div className="card-body p-4">
          <div className="text-base-content/70 text-sm">Channel not found</div>
          <button
            className="btn btn-sm btn-primary w-full mt-2"
            onClick={handleViewChannel}
          >
            View Channel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body p-4">
        <div className="flex items-center gap-3 mb-2">
          {metadata.picture ? (
            <ProxyImg
              src={metadata.picture}
              alt={metadata.name}
              className="w-10 h-10 rounded-full object-cover"
              square={true}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-content">
              {metadata.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-semibold">{metadata.name || "Unnamed Channel"}</h3>
            <p className="text-xs text-base-content/70">
              {authorCount} {authorCount === 1 ? 'person' : 'people'} you follow
            </p>
          </div>
        </div>
        {metadata.about && (
          <p className="text-sm text-base-content/80 mb-3 line-clamp-2">
            {metadata.about}
          </p>
        )}
        <button
          className="btn btn-sm btn-primary w-full"
          onClick={handleViewChannel}
        >
          View Channel
        </button>
      </div>
    </div>
  )
}

export default PopularChannelItem 