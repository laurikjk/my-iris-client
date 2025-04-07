import {useMemo, MutableRefObject, useState} from "react"
import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useNavigate} from "react-router"
import {nip19} from "nostr-tools"
import {decode} from "blurhash"

import {IMAGE_REGEX, VIDEO_REGEX} from "../embed/media/MediaEmbed"
import ProxyImg from "@/shared/components/ProxyImg"
import {localState} from "irisdb/src"
import Icon from "../Icons/Icon"

type ImageGridItemProps = {
  event: NDKEvent
  index: number
  setActiveItemIndex: (url: string) => void
  lastElementRef?: MutableRefObject<HTMLDivElement>
}

let blurNSFW = true

localState.get("settings/blurNSFW").once((value) => {
  if (typeof value === "boolean") {
    blurNSFW = value
  }
})

export const ImageGridItem = ({
  event,
  index,
  setActiveItemIndex,
  lastElementRef,
}: ImageGridItemProps) => {
  const navigate = useNavigate()
  const [loadErrors, setLoadErrors] = useState<Record<number, boolean>>({})

  const imageMatch = event.content.match(IMAGE_REGEX)?.[0]
  const videoMatch = event.content.match(VIDEO_REGEX)?.[0]

  const urls = imageMatch
    ? imageMatch.trim().split(/\s+/)
    : videoMatch?.trim().split(/\s+/) || []

  console.log("ImageGridItem debug:", {
    eventId: event.id,
    urls,
    allTags: event.tags,
    imetaTags: event.tags.filter((t) => t[0] === "imeta"),
  })

  const width = window.innerWidth > 767 ? 314 : 150

  // Get imeta tags for all URLs
  const imetaTags = urls.map((url) => {
    const tag = event.tags.find((tag) => tag[0] === "imeta" && tag[1].includes(url))
    console.log("Looking for imeta tag for URL:", url, "Found:", tag)
    return tag
  })

  // Extract blurhashes for all URLs
  const blurhashes = imetaTags.map((tag) => {
    if (!tag) return null
    // Find the blurhash part in the imeta tag array
    const blurhashPart = tag.find((part) => part.startsWith("blurhash "))
    console.log("Blurhash part:", blurhashPart)
    return blurhashPart ? blurhashPart.split(" ")[1] : null
  })

  console.log("Final blurhashes:", blurhashes)

  // Generate blurhash URLs for all images
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
        console.log("Generated blurhash URL for:", blurhash.substring(0, 10) + "...")
        return dataUrl
      } catch (e) {
        console.error("Error generating blurhash:", e)
        return null
      }
    })
  }, [blurhashes])

  if (!imageMatch && !videoMatch) return null

  return urls.map((url, i) => {
    const isVideo = !imageMatch
    const hasError = loadErrors[i]

    const shouldBlur =
      blurNSFW &&
      (!!event.content.toLowerCase().includes("#nsfw") ||
        event.tags.some((t) => t[0] === "content-warning"))

    return (
      <div
        key={`feed${url}${index}-${i}`}
        className={`aspect-square cursor-pointer relative bg-neutral-300 hover:opacity-80 ${shouldBlur ? "blur-xl" : ""}`}
        onClick={() => {
          if (window.innerWidth > 767) {
            setActiveItemIndex(url)
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
