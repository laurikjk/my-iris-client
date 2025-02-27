import {RiArrowLeftSLine, RiArrowRightSLine} from "@remixicon/react"
import PreloadImages from "@/shared/components/media/PreloadImages"
import {useEffect, useState, MouseEvent, useCallback} from "react"
import MediaModal from "@/shared/components/media/MediaModal"
import ImageComponent from "./ImageComponent"
import VideoComponent from "./VideoComponent"
import {useSwipeable} from "react-swipeable"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {localState} from "irisdb/src"
import classNames from "classnames"

interface MediaItem {
  url: string
  type: "image" | "video"
}

interface CarouselProps {
  media: MediaItem[]
  event?: NDKEvent
}

let blurNSFW = true

localState.get("settings/blurNSFW").once((value) => {
  if (typeof value === "boolean") {
    blurNSFW = value
  }
})

function Carousel({media, event}: CarouselProps) {
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
  }) => (
    <div className="flex space-x-2 mt-2">
      {images.map((_, index) => (
        <span
          key={index}
          className={`h-2 w-2 rounded-full ${index === currentIndex ? "bg-primary" : "bg-gray-300"}`}
        />
      ))}
    </div>
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [blur, setBlur] = useState(
    blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )
  const [showModal, setShowModal] = useState(false)

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
