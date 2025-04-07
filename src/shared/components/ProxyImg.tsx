import {CSSProperties, useEffect, useState, MouseEvent, useRef} from "react"
import {generateProxyUrl} from "../utils/imgproxy"

type Props = {
  src: string
  className?: string
  style?: CSSProperties
  width?: number
  square?: boolean
  onError?: () => void
  onClick?: (ev: MouseEvent) => void
  alt?: string
  hideBroken?: boolean
}

const safeOrigins = [
  "data:image",
  "https://imgur.com/",
  "https://i.imgur.com/",
  "https://imgproxy.iris.to/",
  "https://imgproxy.snort.social/",
]

const shouldSkipProxy = (url: string) => {
  return safeOrigins.some((origin) => url.startsWith(origin))
}

const LOAD_TIMEOUT = 2000 // 2 seconds timeout

const ProxyImg = (props: Props) => {
  const [proxyFailed, setProxyFailed] = useState(false)
  const [src, setSrc] = useState(props.src)
  const [loadFailed, setLoadFailed] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    let mySrc = props.src
    if (
      props.src &&
      !props.src.startsWith("data:image") &&
      (!shouldSkipProxy(props.src) || props.width)
    ) {
      mySrc = generateProxyUrl(props.src, {width: props.width, square: props.square})
      setSrc(mySrc)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [props.src, props.width, props.square])

  useEffect(() => {
    // If we've already switched to the original, do NOT set the timer again
    if (proxyFailed || !src || !imgRef.current) return
    // Otherwise, set your load timer
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      console.log("Image load timeout after 2s on proxy", src)
      handleError()
    }, LOAD_TIMEOUT)

    // Check if the image loaded quickly
    const checkLoading = () => {
      if (imgRef.current?.complete || (imgRef.current?.naturalWidth ?? 0) > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    }

    checkLoading()
    const checkInterval = setInterval(checkLoading, 100)
    return () => clearInterval(checkInterval)
  }, [src, proxyFailed])

  const handleError = () => {
    if (proxyFailed) {
      // We already tried the original, so bail out
      setLoadFailed(true)
      props.onError?.()
      if (props.hideBroken) setSrc("")
    } else {
      // The proxy failed or timed out, so switch to the original
      setProxyFailed(true)
      setSrc(props.src)
    }
  }

  if (!src || loadFailed) {
    return null
  }

  return (
    <img
      ref={imgRef}
      loading="lazy"
      src={src}
      onError={handleError}
      onClick={props.onClick}
      className={props.className}
      style={props.style}
      alt={props.alt}
    />
  )
}

export default ProxyImg
