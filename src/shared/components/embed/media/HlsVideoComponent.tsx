import {useEffect, useRef, useState} from "react"
import classNames from "classnames"
import {localState} from "irisdb"

import {generateProxyUrl} from "../../../utils/imgproxy"
import {NDKEvent} from "@nostr-dev-kit/ndk"

interface HlsVideoComponentProps {
  match: string
  event: NDKEvent | undefined
  limitHeight?: boolean
  onClick?: () => void
  blur?: boolean
}

function HlsVideoComponent({match, event, limitHeight, onClick}: HlsVideoComponentProps) {
  let blurNSFW = true
  localState.get("settings/blurNSFW").on((value) => {
    if (typeof value === "boolean") {
      blurNSFW = value
    }
  })

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [blur, setBlur] = useState(
    blurNSFW &&
      (!!event?.content.toLowerCase().includes("#nsfw") ||
        event?.tags.some((t) => t[0] === "content-warning"))
  )

  useEffect(() => {
    const initHls = async () => {
      if (videoRef.current?.canPlayType("application/vnd.apple.mpegurl")) {
        videoRef.current.src = match
        return
      }

      try {
        const {default: Hls} = await import("hls.js")
        if (Hls.isSupported() && videoRef.current) {
          const hls = new Hls()
          hls.loadSource(match)
          hls.attachMedia(videoRef.current)
        }
      } catch (error) {
        console.error("Failed to load HLS:", error)
      }
    }

    initHls()

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
    <div
      className={classNames("relative w-full object-contain my-2", {
        "h-[600px]": limitHeight,
      })}
    >
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

export default HlsVideoComponent
