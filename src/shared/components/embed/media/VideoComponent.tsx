import {useEffect, useRef, useState} from "react"
import classNames from "classnames"
import {localState} from "irisdb"

import {generateProxyUrl} from "@/shared/utils/imgproxy"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface VideoComponentProps {
  match: string
  event: NDKEvent | undefined
  limitHeight?: boolean
  onClick?: () => void
  blur?: boolean
}

let blurNSFW = true

localState.get("settings/blurNSFW").once((value) => {
  if (typeof value === "boolean") {
    blurNSFW = value
  }
})

function VideoComponent({match, event, limitHeight, onClick}: VideoComponentProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [blur, setBlur] = useState(
    blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )

  useEffect(() => {
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]
      if (entry.isIntersecting) {
        videoRef.current?.play()
      } else {
        videoRef.current?.pause()
      }
    }

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.33,
    })

    if (videoRef.current) {
      observer.observe(videoRef.current)
    }

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current)
      }
    }
  }, [match])

  return (
    <div className="relative w-full justify-center flex object-contain my-2">
      <video
        onClick={(e) => {
          e.stopPropagation()
          if (blur) {
            setBlur(false)
          }
          onClick?.()
        }}
        ref={videoRef}
        className={classNames("max-w-full object-contain", {
          "blur-xl": blur,
          "h-full max-h-[600px]": limitHeight,
          "max-h-[90vh] lg:max-h-[600px]": !limitHeight,
        })}
        src={match}
        controls
        muted
        autoPlay
        playsInline
        loop
        poster={generateProxyUrl(match, {height: 638})}
      ></video>
    </div>
  )
}

export default VideoComponent
