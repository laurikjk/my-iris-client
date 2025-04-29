import SmallImageComponent from "../embed/media/SmallImageComponent"
import {RiImageLine} from "@remixicon/react"
import {NDKEvent} from "@nostr-dev-kit/ndk"

type MarketImageProps = {
  event: NDKEvent
  imageUrl: string | null
  size?: number
  className?: string
}

/**
 * A reusable component for displaying market listing images
 */
const MarketImage = ({event, imageUrl, size = 160, className = ""}: MarketImageProps) => {
  return (
    <div className={`flex-shrink-0 ${className}`}>
      {imageUrl ? (
        <SmallImageComponent match={imageUrl} event={event} size={size} />
      ) : (
        <div
          className={`w-${size} h-${size} bg-base-200 rounded flex items-center justify-center`}
        >
          <RiImageLine className="w-8 h-8 text-base-content/50" />
        </div>
      )}
    </div>
  )
}

export default MarketImage
