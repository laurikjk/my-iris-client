import {NDKEvent} from "@nostr-dev-kit/ndk"
import {useNavigate} from "react-router"
import {nip19} from "nostr-tools"

import {IMAGE_REGEX, VIDEO_REGEX} from "../embed/media/MediaEmbed"
import {generateProxyUrl} from "@/shared/utils/imgproxy"
import ProxyImg from "@/shared/components/ProxyImg"
import {MutableRefObject} from "react"
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

  const imageMatch = event.content.match(IMAGE_REGEX)?.[0]
  const videoMatch = event.content.match(VIDEO_REGEX)?.[0]

  if (!imageMatch && !videoMatch) return null

  const urls = imageMatch
    ? imageMatch.trim().split(/\s+/)
    : videoMatch!.trim().split(/\s+/)

  return urls.map((url, i) => {
    const isVideo = !imageMatch
    const proxyUrl = isVideo ? generateProxyUrl(url, {width: 638}) : url

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
        <ProxyImg
          square={true}
          width={319}
          src={proxyUrl}
          alt=""
          className="w-full h-full object-cover"
        />
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
