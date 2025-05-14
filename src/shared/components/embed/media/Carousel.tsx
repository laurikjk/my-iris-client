import {RiArrowLeftSLine, RiArrowRightSLine} from "@remixicon/react"
import {useEffect, useState, MouseEvent, useCallback} from "react"
import {useSwipeable} from "react-swipeable"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import classNames from "classnames"

import PreloadImages from "@/shared/components/media/PreloadImages"
import MediaModal from "@/shared/components/media/MediaModal"
import {useSettingsStore} from "@/stores/settings"
import ImageComponent from "./ImageComponent"
import VideoComponent from "./VideoComponent"

interface MediaItem {
  url: string
  type: "image" | "video"
  imeta?: string[]
}

interface CarouselProps {
  media: MediaItem[]
  event?: NDKEvent
}

function Carousel({media, event}: CarouselProps) {
  const {content} = useSettingsStore()
  const CarouselButton = ({
    direction,
    onClick,
  }: {
    direction: "left" | "right"
    onClick: (e: MouseEvent<HTMLButtonElement>) => void
  }) => (
    <button
      onClick={(e) => onClick(e as MouseEvent<HTMLButtonElement>)}
      className={`absolute top-1/2 ${direction === "left" ? "left-0" : "right-0"} transform -translate-y-1/2 bg-gray-800 rounded-full opacity-50 text-white p-2`}
    >
      {direction === "left" ? (
        <RiArrowLeftSLine size={24} />
      ) : (
        <RiArrowRightSLine size={24} />
      )}
    </button>
  )

  const ImageIndicators = ({
    images,
    currentIndex,
  }: {
    images: MediaItem[]
    currentIndex: number
  }) => {
    const MAX_INDICATORS = 10
    const totalImages = images.length

    if (totalImages <= MAX_INDICATORS) {
      return (
        <div className="flex space-x-2 mt-2">
          {images.map((_, index) => (
            <span
              key={index}
              className={`h-2 w-2 rounded-full ${index === currentIndex ? "bg-primary" : "bg-gray-300"}`}
            />
          ))}
        </div>
      )
    }

    // Calculate the window of indicators to show
    const windowSize = MAX_INDICATORS - 2 // Reserve 2 spots for ellipsis
    const halfWindow = Math.floor(windowSize / 2)
    let startIndex = currentIndex - halfWindow
    let endIndex = currentIndex + halfWindow

    // Adjust window if near the start or end
    if (startIndex < 0) {
      startIndex = 0
      endIndex = windowSize
    } else if (endIndex >= totalImages) {
      endIndex = totalImages - 1
      startIndex = endIndex - windowSize
    }

    return (
      <div className="flex items-center space-x-2 mt-2">
        {startIndex > 0 && (
          <>
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            <span className="text-gray-400">...</span>
          </>
        )}
        {Array.from({length: endIndex - startIndex + 1}).map((_, i) => {
          const index = startIndex + i
          return (
            <span
              key={index}
              className={`h-2 w-2 rounded-full ${
                index === currentIndex ? "bg-primary" : "bg-gray-300"
              }`}
            />
          )
        })}
        {endIndex < totalImages - 1 && (
          <>
            <span className="text-gray-400">...</span>
            <span className="h-2 w-2 rounded-full bg-gray-300" />
          </>
        )}
        <span className="text-sm text-gray-500 ml-2">
          {currentIndex + 1} / {totalImages}
        </span>
      </div>
    )
  }

  const [currentIndex, setCurrentIndex] = useState(0)
  const [blur, setBlur] = useState(
    content.blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )
  const [showModal, setShowModal] = useState(false)
  const [isMuted, setIsMuted] = useState(content.autoplayVideos)

  const nextImage = (e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation()
    setCurrentIndex((prevIndex) => (prevIndex + 1) % media.length)
  }

  const prevImage = (e?: MouseEvent | KeyboardEvent) => {
    e?.stopPropagation()
    setCurrentIndex((prevIndex) => (prevIndex - 1 + media.length) % media.length)
  }

  const onClickImage = () => {
    if (blur) {
      setBlur(false)
    } else {
      setShowModal(true)
    }
  }

  const handlers = useSwipeable({
    onSwipedLeft: () => nextImage(),
    onSwipedRight: () => prevImage(),
    preventScrollOnSwipe: true,
    trackMouse: true,
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        nextImage(e)
      } else if (e.key === "ArrowLeft") {
        prevImage(e)
      }
    }

    if (showModal) {
      window.addEventListener("keydown", handleKeyDown)
    } else {
      window.removeEventListener("keydown", handleKeyDown)
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showModal])

  const onCloseModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const limitHeight = media.length > 1

  const renderMediaComponent = (item: MediaItem, index: number) => {
    if (item.type === "image") {
      return (
        <ImageComponent
          match={item.url}
          index={index}
          onClickImage={onClickImage}
          blur={blur}
          key={item.url}
          limitHeight={limitHeight}
          imeta={item.imeta}
        />
      )
    }

    return (
      <VideoComponent
        match={item.url}
        event={event}
        key={item.url}
        blur={blur}
        onClick={() => setBlur(false)}
        limitHeight={limitHeight}
        imeta={item.imeta}
        isMuted={isMuted}
        onMuteChange={setIsMuted}
      />
    )
  }

  return (
    <>
      <div className="w-full my-2 flex flex-col items-center gap-2">
        <div
          {...handlers}
          className={classNames(
            `relative w-full flex flex-col items-center justify-center`,
            {
              "h-[600px]": limitHeight,
            }
          )}
        >
          {renderMediaComponent(media[currentIndex], currentIndex)}
          {media.length > 1 && (
            <>
              <CarouselButton direction="left" onClick={prevImage} />
              <CarouselButton direction="right" onClick={nextImage} />
              <PreloadImages
                images={media.filter((m) => m.type === "image").map((m) => m.url)}
                currentIndex={currentIndex}
                size={650}
              />
            </>
          )}
          {showModal && (
            <MediaModal
              onClose={onCloseModal}
              onPrev={media.length > 1 ? prevImage : undefined}
              onNext={media.length > 1 ? nextImage : undefined}
              mediaUrl={media[currentIndex].url}
              mediaType={media[currentIndex].type}
              currentIndex={media.length > 1 ? currentIndex : undefined}
              totalCount={media.length > 1 ? media.length : undefined}
            />
          )}
        </div>
        {media.length > 1 && (
          <ImageIndicators images={media} currentIndex={currentIndex} />
        )}
      </div>
    </>
  )
}

export default Carousel
