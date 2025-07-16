import {useMemo, MutableRefObject, useState, useEffect} from "react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useNavigate} from "react-router"
import {nip19} from "nostr-tools"
import {decode} from "blurhash"

import {IMAGE_REGEX, VIDEO_REGEX} from "../embed/media/MediaEmbed"
import {isMarketListing} from "@/shared/utils/marketUtils"
import MarketGridItem from "../market/MarketGridItem"
import ProxyImg from "@/shared/components/ProxyImg"
import {useSettingsStore} from "@/stores/settings"
import {eventsByIdCache} from "@/utils/memcache"
import {fetchEvent} from "@/utils/nostr"
import Icon from "../Icons/Icon"

type ImageGridItemProps = {
  event: NDKEvent | {id: string}
  index: number
  setActiveItemIndex: (event: NDKEvent, url: string) => void
  onEventRendered?: (event: NDKEvent) => void
  lastElementRef?: MutableRefObject<HTMLDivElement>
}

export const ImageGridItem = ({
  event: initialEvent,
  index,
  setActiveItemIndex,
  onEventRendered,
  lastElementRef,
}: ImageGridItemProps) => {
  const navigate = useNavigate()
  const [loadErrors, setLoadErrors] = useState<Record<number, boolean>>({})
  const [event, setEvent] = useState<NDKEvent | undefined>(
    "content" in initialEvent ? initialEvent : undefined
  )
  const {content} = useSettingsStore()

  const eventIdHex = useMemo(() => {
    return "content" in initialEvent ? initialEvent.id : initialEvent.id
  }, [initialEvent])

  useEffect(() => {
    if (event) {
      onEventRendered?.(event)
      return
    }

    if (eventIdHex) {
      const cached = eventsByIdCache.get(eventIdHex)
      if (cached) {
        setEvent(cached)
        onEventRendered?.(cached)
      } else {
        fetchEvent({ids: [eventIdHex]}).then((fetched) => {
          if (fetched) {
            setEvent(fetched)
            eventsByIdCache.set(eventIdHex, fetched)
            onEventRendered?.(fetched)
          }
        })
      }
    }
  }, [event, eventIdHex, onEventRendered])

  const imageMatch = event?.content.match(IMAGE_REGEX)?.[0]
  const videoMatch = event?.content.match(VIDEO_REGEX)?.[0]

  const urls = imageMatch
    ? imageMatch.trim().split(/\s+/)
    : videoMatch?.trim().split(/\s+/) || []

  const width = window.innerWidth > 767 ? 314 : 150

  const imetaTags = urls.map((url) => {
    const tag = event?.tags.find((tag) => tag[0] === "imeta" && tag[1].includes(url))
    return tag
  })

  const blurhashes = imetaTags.map((tag) => {
    if (!tag) return null
    const blurhashPart = tag.find((part) => part.startsWith("blurhash "))
    return blurhashPart ? blurhashPart.split(" ")[1] : null
  })

  const blurhashUrls = useMemo(() => {
    return blurhashes.map((blurhash) => {
      if (!blurhash) return null
      try {
        const pixels = decode(blurhash, 32, 32)
        const canvas = document.createElement("canvas")
        canvas.width = 32
        canvas.height = 32
        const ctx = canvas.getContext("2d")
        if (!ctx) return null
        const imageData = ctx.createImageData(32, 32)
        imageData.data.set(pixels)
        ctx.putImageData(imageData, 0, 0)
        const dataUrl = canvas.toDataURL()
        return dataUrl
      } catch (e) {
        return null
      }
    })
  }, [blurhashes])

  const isBlurred =
    content.blurNSFW &&
    (!!event?.content.toLowerCase().includes("#nsfw") ||
      event?.tags.some((t) => t[0] === "content-warning"))

  if (!event) {
    return <div className="aspect-square bg-neutral-300 animate-pulse" />
  }

  if (
    event.kind !== 30402 &&
    !IMAGE_REGEX.test(event.content) &&
    !VIDEO_REGEX.test(event.content)
  ) {
    return null
  }

  if (isMarketListing(event)) {
    const shouldBlur =
      isBlurred &&
      (!!event.content.toLowerCase().includes("#nsfw") ||
        event.tags.some((t) => t[0] === "content-warning"))

    return <MarketGridItem event={event} shouldBlur={shouldBlur} width={width} />
  }

  return urls.map((url, i) => {
    const isVideo = !imageMatch
    const hasError = loadErrors[i]

    const shouldBlur =
      isBlurred &&
      (!!event.content.toLowerCase().includes("#nsfw") ||
        event.tags.some((t) => t[0] === "content-warning"))

    return (
      <div
        key={`feed${url}${index}-${i}`}
        className={`aspect-square cursor-pointer relative bg-neutral-300 hover:opacity-80 ${shouldBlur ? "blur-xl" : ""}`}
        onClick={() => {
          if (window.innerWidth > 767) {
            setActiveItemIndex(event, url)
          } else {
            navigate(`/${nip19.noteEncode(event.id)}`)
          }
        }}
        ref={i === urls.length - 1 ? lastElementRef : undefined}
      >
        {hasError ? (
          <div
            className="w-full h-full"
            style={{
              backgroundImage: blurhashUrls[i] ? `url(${blurhashUrls[i]})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : (
          <ProxyImg
            square={true}
            width={width}
            src={url}
            alt=""
            className="w-full h-full object-cover"
            style={{
              backgroundImage: blurhashUrls[i] ? `url(${blurhashUrls[i]})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            onError={() => setLoadErrors((prev) => ({...prev, [i]: true}))}
          />
        )}
        {isVideo && (
          <div className="absolute top-0 right-0 m-2 shadow-md shadow-gray-500">
            <Icon
              name="play-square-outline"
              className="text-white opacity-80 drop-shadow-md"
            />
          </div>
        )}
      </div>
    )
  })
}

export default ImageGridItem
