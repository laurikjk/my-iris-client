import {useState} from "react"
import FeedItem from "../event/FeedItem/FeedItem"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {EmbedEvent} from "../embed/index"
import ProxyImg from "../ProxyImg"
import Icon from "../Icons/Icon"
import Modal from "../ui/Modal"
import SwipableCarousel from "../ui/SwipableCarousel"
import {SwipeItem} from "@/shared/hooks/useSwipable"

interface MediaModalProps {
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  mediaUrl?: string
  mediaType?: "image" | "video"
  media?: SwipeItem[]
  showFeedItem?: boolean
  event?: EmbedEvent
  currentIndex?: number
}

function isNDKEvent(event: EmbedEvent): event is NDKEvent {
  return event && typeof (event as NDKEvent).rawEvent !== "undefined"
}

function MediaModal({
  onClose,
  onPrev,
  onNext,
  mediaUrl,
  mediaType,
  media,
  showFeedItem,
  event,
  currentIndex: propCurrentIndex,
}: MediaModalProps) {
  // Use full media array if provided, otherwise create single item array
  const mediaItems =
    media ||
    (mediaUrl && mediaType
      ? [
          {
            id: mediaUrl,
            url: mediaUrl,
            type: mediaType,
          },
        ]
      : [])

  const initialIndex = propCurrentIndex ?? 0
  const [currentModalIndex, setCurrentModalIndex] = useState(initialIndex)

  const renderMediaItem = (
    item: SwipeItem,
    _index: number,
    wasDragged: {current: boolean}
  ) => {
    const handleImageClick = () => {
      // Don't close modal if this was a drag
      if (wasDragged.current) return
      if (!showFeedItem) onClose()
    }

    return item.type === "video" ? (
      <video loop autoPlay src={item.url} controls className="max-w-full max-h-full" />
    ) : (
      <ProxyImg
        src={item.url}
        className="max-w-full max-h-full object-contain"
        onClick={handleImageClick}
        key={item.url}
      />
    )
  }

  return (
    <Modal hasBackground={false} onClose={onClose}>
      <div className="relative flex w-screen h-screen">
        <div className="flex-1 relative bg-base-200/90 select-none">
          <button
            className="btn btn-circle btn-ghost absolute right-2 top-2 focus:outline-none text-white z-10"
            onClick={onClose}
          >
            <Icon name="close" size={12} />
          </button>

          <div
            className="absolute inset-0 flex items-center justify-center"
            onClick={(e) => {
              console.log("MediaModal Clicked:", e.target === e.currentTarget)
              if (e.target === e.currentTarget) {
                onClose()
              }
            }}
          >
            {mediaItems.length > 0 && (
              <SwipableCarousel
                items={mediaItems}
                renderItem={renderMediaItem}
                initialIndex={initialIndex}
                className="w-full h-full"
                enableKeyboardNav={true}
                onClose={onClose}
                showArrows={mediaItems.length > 1}
                onBackgroundClick={onClose}
                onIndexChange={(index) => {
                  setCurrentModalIndex(index)
                  // Call legacy callbacks if provided for backwards compatibility
                  if (index > currentModalIndex) {
                    onNext?.()
                  } else if (index < currentModalIndex) {
                    onPrev?.()
                  }
                }}
              />
            )}
          </div>

          {mediaItems.length > 1 && (
            <div className="absolute top-2 left-2 text-white bg-black bg-opacity-50 px-2 py-1 rounded z-10">
              {currentModalIndex + 1} / {mediaItems.length}
            </div>
          )}
        </div>

        {showFeedItem && event && (
          <div className="w-[400px] bg-base-100 border-l flex-shrink-0 overflow-y-auto">
            <FeedItem
              key={isNDKEvent(event) ? event.id : undefined}
              event={isNDKEvent(event) ? event : undefined}
              asReply={false}
              showRepliedTo={true}
              showReplies={Infinity}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

export default MediaModal
